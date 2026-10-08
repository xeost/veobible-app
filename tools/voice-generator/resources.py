"""Keep synthesis in a disposable, supervised process without loading Torch here."""

import fcntl
import math
import os
import signal
import subprocess
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

import psutil

MIB = 1024 * 1024


@dataclass(frozen=True)
class Limits:
    profile: str = "low"
    threads: int = 2
    max_memory_mb: float = 6144
    min_free_memory_mb: float = 1024
    timeout_seconds: float = 1800
    lock_timeout_seconds: float = 300
    memory_grace_seconds: float = 5

    def validate(self):
        if self.profile not in ("low", "standard"):
            raise ValueError("VOICE_GENERATOR_PROFILE must be low or standard")
        for name, value in vars(self).items():
            if name != "profile" and (not math.isfinite(value) or value <= 0):
                raise ValueError(f"{name} must be a finite positive number")
        if self.threads > (os.cpu_count() or 1):
            raise ValueError("threads cannot exceed the number of available CPU cores")


def failure_reason(limits: Limits, elapsed: float, rss: int, available: int, low_memory_seconds: float = 0) -> str | None:
    if elapsed >= limits.timeout_seconds:
        return "VOICE_TIMEOUT: generation exceeded its time limit"
    if rss > limits.max_memory_mb * MIB:
        return f"VOICE_RESOURCE_LIMIT: worker RSS {rss / MIB:.0f} MiB exceeded {limits.max_memory_mb:g} MiB"
    reserve = limits.min_free_memory_mb * MIB
    critical = min(256 * MIB, reserve / 4)
    if available < critical:
        return f"VOICE_RESOURCE_LIMIT: critically low available RAM ({available / MIB:.0f} MiB; emergency threshold {critical / MIB:g} MiB)"
    if available < reserve and low_memory_seconds >= limits.memory_grace_seconds:
        return f"VOICE_RESOURCE_LIMIT: available RAM {available / MIB:.0f} MiB stayed below {limits.min_free_memory_mb:g} MiB for {low_memory_seconds:.1f}s; worker RSS {rss / MIB:.0f} MiB"
    return None


@dataclass
class ResourceMonitor:
    limits: Limits
    started: float
    low_memory_since: float | None = None

    def check(self, now: float, rss: int, available: int) -> str | None:
        # Require continuous pressure, allowing macOS time to reclaim memory.
        if available < self.limits.min_free_memory_mb * MIB:
            if self.low_memory_since is None:
                self.low_memory_since = now
        else:
            self.low_memory_since = None
        duration = now - self.low_memory_since if self.low_memory_since is not None else 0
        return failure_reason(self.limits, now - self.started, rss, available, duration)


def process_memory(process: psutil.Process) -> int:
    total = 0
    try:
        children = process.children(recursive=True)
    except psutil.NoSuchProcess:
        return 0
    for member in [process, *children]:
        try:
            total += member.memory_info().rss
        except psutil.NoSuchProcess:
            pass
    return total


@contextmanager
def generation_lock(timeout_seconds: float, lock_path: Path | None = None):
    # Never unlink the lock: other processes may already hold the same inode.
    path = lock_path or Path("/tmp") / f"veobible-voice-{os.getuid()}.lock"
    with path.open("a+") as lock:
        started = time.monotonic()
        announced = False
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if not announced:
                    print("Stage: Waiting for another voice generation", flush=True)
                    announced = True
                if time.monotonic() - started >= timeout_seconds:
                    raise RuntimeError("VOICE_BUSY: another voice generation is still running")
                time.sleep(0.25)
        # The inherited descriptor also keeps the lock held if the supervisor dies.
        yield lock.fileno()


def stop_process(process: subprocess.Popen):
    # Stop the entire session, including converters and model subprocesses.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def supervise(command: list[str], limits: Limits, lock_fd: int) -> int:
    limits.validate()
    # Do not start loading a model if the reserve is already unavailable.
    available = psutil.virtual_memory().available
    initial_failure = failure_reason(limits, 0, 0, available)
    if initial_failure:
        raise RuntimeError(initial_failure)
    if available < limits.min_free_memory_mb * MIB:
        raise RuntimeError(f"VOICE_RESOURCE_LIMIT: available RAM before model loading is {available / MIB:.0f} MiB; at least {limits.min_free_memory_mb:g} MiB is required")
    env = os.environ.copy()
    for name in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "NUMEXPR_NUM_THREADS"):
        env[name] = str(limits.threads)
    env["TOKENIZERS_PARALLELISM"] = "false"
    env["PYTHONUNBUFFERED"] = "1"
    monitor = ResourceMonitor(limits, time.monotonic())
    process = subprocess.Popen(command, env=env, start_new_session=True, pass_fds=(lock_fd,))
    try:
        watched = psutil.Process(process.pid)
        while process.poll() is None:
            reason = monitor.check(time.monotonic(), process_memory(watched), psutil.virtual_memory().available)
            if reason:
                raise RuntimeError(reason)
            time.sleep(0.5)
        if process.returncode < 0:
            raise RuntimeError(f"Voice worker interrupted by {signal.Signals(-process.returncode).name}")
        return process.returncode
    except psutil.NoSuchProcess:
        return process.wait()
    except (psutil.AccessDenied, PermissionError) as error:
        raise RuntimeError("Cannot supervise voice process memory; generation stopped") from error
    finally:
        stop_process(process)


def configure_worker(limits: Limits, device: str):
    if limits.profile == "low":
        os.nice(10)
    import torch
    torch.set_num_threads(limits.threads)
    torch.set_num_interop_threads(1)
    if device == "mps" or (device == "auto" and torch.backends.mps.is_available() and not torch.cuda.is_available()):
        # This bounds the Metal allocator only; the supervisor separately watches RSS.
        budget = min(4096 * MIB, limits.max_memory_mb * MIB)
        torch.mps.set_per_process_memory_fraction(min(1.0, budget / torch.mps.recommended_max_memory()))
