import sys
import tempfile
import time
import unittest
import types
from pathlib import Path
from unittest.mock import patch

import psutil
from resources import Limits, MIB, ResourceMonitor, configure_worker, failure_reason, generation_lock, supervise


class SupervisorTests(unittest.TestCase):
    def test_worker_limits_torch_threads_and_priority_before_loading_model(self):
        from unittest.mock import Mock
        torch = types.SimpleNamespace(set_num_threads=Mock(), set_num_interop_threads=Mock())
        with patch.dict(sys.modules, {"torch": torch}), patch("resources.os.nice") as nice:
            configure_worker(Limits(), "cpu")
        nice.assert_called_once_with(10)
        torch.set_num_threads.assert_called_once_with(2)
        torch.set_num_interop_threads.assert_called_once_with(1)

    def test_thresholds_and_validation(self):
        limits = Limits()
        self.assertIsNone(failure_reason(limits, 1, 100 * MIB, 4096 * MIB))
        self.assertIn("VOICE_TIMEOUT", failure_reason(limits, 1800, 0, 4096 * MIB))
        self.assertIn("VOICE_RESOURCE_LIMIT", failure_reason(limits, 1, 6145 * MIB, 4096 * MIB))
        self.assertIn("VOICE_RESOURCE_LIMIT", failure_reason(limits, 1, 0, 1023 * MIB, 5))
        for value in (0, -1, float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                Limits(max_memory_mb=value).validate()

    def test_transient_low_memory_recovers_and_resets_the_grace_period(self):
        monitor = ResourceMonitor(Limits(), 0)
        self.assertIsNone(monitor.check(1, 2000 * MIB, 900 * MIB))
        self.assertIsNone(monitor.check(5, 2000 * MIB, 900 * MIB))
        self.assertIsNone(monitor.check(6, 2000 * MIB, 1100 * MIB))
        self.assertIsNone(monitor.check(7, 2000 * MIB, 900 * MIB))
        self.assertIsNone(monitor.check(11, 2000 * MIB, 900 * MIB))
        self.assertIn("stayed below 1024 MiB for 5.0s", monitor.check(12, 2000 * MIB, 900 * MIB))

    def test_critical_memory_and_rss_limit_do_not_wait_for_grace_period(self):
        monitor = ResourceMonitor(Limits(), 0)
        self.assertIn("critically low", monitor.check(1, 2000 * MIB, 255 * MIB))
        self.assertIn("worker RSS 6145 MiB", monitor.check(2, 6145 * MIB, 900 * MIB))

    def test_custom_grace_period(self):
        monitor = ResourceMonitor(Limits(memory_grace_seconds=2), 0)
        self.assertIsNone(monitor.check(1, 1000 * MIB, 900 * MIB))
        self.assertIsNone(monitor.check(2, 1000 * MIB, 900 * MIB))
        self.assertIn("VOICE_RESOURCE_LIMIT", monitor.check(3, 1000 * MIB, 900 * MIB))

    def test_preflight_does_not_launch_with_insufficient_memory(self):
        with patch("resources.psutil.virtual_memory", return_value=type("Memory", (), {"available": MIB})()), patch("resources.subprocess.Popen") as launch:
            with self.assertRaisesRegex(RuntimeError, "VOICE_RESOURCE_LIMIT"):
                supervise([sys.executable, "-c", "pass"], Limits(), 0)
            launch.assert_not_called()

    def test_preflight_requires_reserve_before_starting_even_above_emergency_threshold(self):
        with patch("resources.psutil.virtual_memory", return_value=types.SimpleNamespace(available=900 * MIB)), patch("resources.subprocess.Popen") as launch:
            with self.assertRaisesRegex(RuntimeError, "before model loading is 900 MiB"):
                supervise([sys.executable, "-c", "pass"], Limits(), 0)
            launch.assert_not_called()

    def test_timeout_terminates_worker_and_its_child_and_releases_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pid_file = root / "pids"
            script = (
                "import os, subprocess, sys, time; "
                "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)']); "
                "open(sys.argv[1], 'w').write(str(os.getpid()) + ',' + str(child.pid)); "
                "time.sleep(60)"
            )
            lock = root / "lock"
            with generation_lock(1, lock) as fd:
                with self.assertRaisesRegex(RuntimeError, "VOICE_TIMEOUT"):
                    supervise([sys.executable, "-c", script, str(pid_file)], Limits(timeout_seconds=1, min_free_memory_mb=1), fd)
            for pid in map(int, pid_file.read_text().split(",")):
                for _ in range(20):
                    if not psutil.pid_exists(pid) or psutil.Process(pid).status() == psutil.STATUS_ZOMBIE:
                        break
                    time.sleep(0.05)
                else:
                    self.fail(f"Process {pid} survived its supervisor")
            with generation_lock(0.1, lock):
                pass

    def test_memory_watchdog_stops_worker(self):
        with tempfile.TemporaryDirectory() as directory:
            with generation_lock(1, Path(directory) / "lock") as fd:
                with self.assertRaisesRegex(RuntimeError, "VOICE_RESOURCE_LIMIT"):
                    supervise([sys.executable, "-c", "import time; data = bytearray(32 * 1024 * 1024); time.sleep(30)"], Limits(max_memory_mb=24, min_free_memory_mb=1), fd)

    def test_second_invocation_cannot_acquire_shared_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            lock = Path(directory) / "lock"
            with generation_lock(1, lock):
                with self.assertRaisesRegex(RuntimeError, "VOICE_BUSY"):
                    with generation_lock(0.05, lock):
                        self.fail("A second invocation acquired the lock")

    def test_success_relay_and_thread_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            with generation_lock(1, Path(directory) / "lock") as fd:
                result = supervise([sys.executable, "-c", "import os; assert os.environ['OMP_NUM_THREADS'] == '2'; assert os.environ['TOKENIZERS_PARALLELISM'] == 'false'"], Limits(min_free_memory_mb=1), fd)
                self.assertEqual(result, 0)

    def test_timeout_escalates_when_worker_ignores_termination(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pid_file = root / "pid"
            script = "import os, signal, sys, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); open(sys.argv[1], 'w').write(str(os.getpid())); time.sleep(60)"
            with generation_lock(1, root / "lock") as fd:
                with self.assertRaisesRegex(RuntimeError, "VOICE_TIMEOUT"):
                    supervise([sys.executable, "-c", script, str(pid_file)], Limits(timeout_seconds=1, min_free_memory_mb=1), fd)
            self.assertFalse(psutil.pid_exists(int(pid_file.read_text())))


if __name__ == "__main__":
    unittest.main()
