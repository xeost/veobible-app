import argparse
from array import array
from contextlib import redirect_stdout, redirect_stderr
import io
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave

import cli


class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.source = self.root / "audios"
        self.source.mkdir()
        self.output = self.root / "enhanced"

    def test_env_literal_quotes_and_precedence(self):
        env = self.root / ".env"
        env.write_text("AUDIO_TEST='path with spaces' # comment\nexport AUDIO_OTHER=$(literal)\n")
        with patch.dict(os.environ, {"AUDIO_TEST": "override"}):
            values = cli.load_env(env)
        self.assertEqual(values["AUDIO_TEST"], "override")
        self.assertEqual(values["AUDIO_OTHER"], "$(literal)")

    def test_overlapping_roots_rejected(self):
        for output in (self.source, self.source / "out", self.root):
            with self.subTest(output=output), self.assertRaises(cli.EnhanceError):
                cli.roots({"AUDIO_ENHANCE_INPUT_DIR": str(self.source),
                           "AUDIO_ENHANCE_OUTPUT_DIR": str(output)})

    def test_version_traversal_rejected(self):
        for version in ("../audios", "/tmp", ".", "rv1909/other"):
            with self.subTest(version=version), self.assertRaises(cli.EnhanceError):
                cli.version_dir(self.source, version)

    def test_symlink_output_into_source_rejected(self):
        self.output.mkdir()
        (self.output / "rv1909").symlink_to(self.source, target_is_directory=True)
        with self.assertRaises(cli.EnhanceError):
            cli.output_guard(self.output / "rv1909" / "chapter.wav", self.output)

    def test_source_symlink_rejected(self):
        (self.source / "real.wav").touch()
        (self.source / "link.wav").symlink_to(self.source / "real.wav")
        with self.assertRaises(cli.EnhanceError):
            cli.audio_files(self.source)

    def test_numeric_order_and_pattern(self):
        for name in ("01-genesis-10.mp3", "01-genesis-2.mp3", "01-genesis-1.mp3", "02-exodus-1.m4a", "README.md"):
            (self.source / name).touch()
        files = cli.audio_files(self.source, "01-genesis-*.mp3", 2)
        self.assertEqual([file.name for file in files], ["01-genesis-1.mp3", "01-genesis-2.mp3"])

    def test_nonfinite_options_rejected(self):
        for value in ("nan", "inf", "-inf", "3"):
            with self.subTest(value=value), self.assertRaises(argparse.ArgumentTypeError):
                cli.bounded_number(0, 2)(value)

    def test_silence_normalization_rejected(self):
        args = cli.parser().parse_args(["enhance", "rv1909"])
        with self.assertRaises(cli.EnhanceError):
            cli.norm_filter(args, {"input_i": "-inf"})

    def test_concurrent_lock_rejected(self):
        target = self.output / "rv1909"
        with cli.output_lock(target, self.output):
            with self.assertRaises(cli.EnhanceError):
                with cli.output_lock(target, self.output):
                    self.fail("Se adquirió un bloqueo duplicado")


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "Requiere FFmpeg y ffprobe")
class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.source = self.root / "audios" / "rv1909"
        self.source.mkdir(parents=True)
        self.output = self.root / "enhanced"
        self.env = self.root / ".env"
        self.env.write_text(f"AUDIO_ENHANCE_INPUT_DIR={self.source.parent}\nAUDIO_ENHANCE_OUTPUT_DIR={self.output}\n")
        self.input = self.source / "01-genesis-1.wav"
        rate = 48000
        with wave.open(str(self.input), "wb") as file:
            file.setparams((1, 2, rate, 0, "NONE", "not compressed"))
            samples = array("h")
            for index in range(rate * 8):
                t = index / rate
                envelope = 0.8 + 0.2 * math.sin(2 * math.pi * 0.4 * t)
                value = envelope * 0.04 * (math.sin(2 * math.pi * 120 * t) + math.sin(2 * math.pi * 3200 * t))
                samples.append(round(value * 32767))
            if sys.byteorder == "big":
                samples.byteswap()
            file.writeframes(samples.tobytes())
        self.before = self.input.read_bytes()
        self.args = cli.parser().parse_args(["enhance", "rv1909", "--format", "wav"])
        self.executables = cli.binaries({}, "wav")

    def invoke(self, *args):
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            return cli.main(["--env-file", str(self.env), *args])

    def test_dry_run_writes_nothing(self):
        self.assertEqual(self.invoke("enhance", "rv1909", "--dry-run"), 0)
        self.assertFalse(self.output.exists())
        self.assertEqual(self.input.read_bytes(), self.before)

    def test_render_spectral_effect_loudness_and_resume(self):
        self.assertEqual(self.invoke("enhance", "rv1909", "--format", "wav"), 0)
        output = self.output / "rv1909" / self.input.name
        info = cli.probe(self.executables[1], output)
        self.assertAlmostEqual(info["duration"], 8, delta=0.03)
        self.assertEqual((info["channels"], info["sample_rate"]), (1, 48000))
        command = [self.executables[0], "-v", "error", "-i", str(output), "-f", "s16le", "-c:a", "pcm_s16le", "-"]
        decoded = subprocess.run(command, check=True, capture_output=True).stdout
        samples = struct.unpack("<" + "h" * (len(decoded) // 2), decoded)
        samples = samples[48000:96000]

        def energy(frequency):
            real = sum(value * math.cos(2 * math.pi * frequency * index / 48000) for index, value in enumerate(samples))
            imag = sum(value * math.sin(2 * math.pi * frequency * index / 48000) for index, value in enumerate(samples))
            return real * real + imag * imag

        self.assertGreater(10 * math.log10(energy(120) / energy(3200)), 3)
        _, measured = cli.run([self.executables[0], "-hide_banner", "-i", str(output), "-af", "loudnorm=print_format=json", "-f", "null", "-"])
        stats = cli.loudness_json(measured)
        self.assertAlmostEqual(float(stats["input_i"]), -18, delta=0.5)
        self.assertLessEqual(float(stats["input_tp"]), -1.8)
        report = json.loads(output.with_suffix(".wav.json").read_text())
        self.assertIn(report["render_loudness_before_encoding"]["normalization_type"], ("linear", "dynamic"))
        original_mtime = output.stat().st_mtime_ns
        self.assertEqual(self.invoke("enhance", "rv1909", "--format", "wav"), 0)
        self.assertEqual(output.stat().st_mtime_ns, original_mtime)
        self.assertEqual(self.input.read_bytes(), self.before)

    def test_changed_settings_need_force(self):
        output = self.output / "rv1909" / self.input.name
        self.assertEqual(self.invoke("enhance", "rv1909", "--format", "wav"), 0)
        previous = output.read_bytes()
        self.assertEqual(self.invoke("enhance", "rv1909", "--format", "wav", "--strength", "0.5"), 1)
        self.assertEqual(output.read_bytes(), previous)
        self.assertEqual(self.invoke("enhance", "rv1909", "--format", "wav", "--strength", "0.5", "--force"), 0)
        self.assertNotEqual(output.read_bytes(), previous)
        self.assertEqual(self.input.read_bytes(), self.before)

    def test_encoder_failure_preserves_existing_output_and_cleans_temp(self):
        destination = self.output / "rv1909" / self.input.name
        destination.parent.mkdir(parents=True)
        destination.write_bytes(b"previous output")
        self.args.force = True
        actual_run = cli.run

        def fail_encoding(command):
            if "-y" in command and command[-1].endswith(".wav"):
                Path(command[-1]).write_bytes(b"partial output")
                raise cli.EnhanceError("Simulated encoder failure")
            return actual_run(command)

        with patch.object(cli, "run", side_effect=fail_encoding), redirect_stdout(io.StringIO()):
            with self.assertRaises(cli.EnhanceError):
                cli.process_audio(self.input, destination, self.output, self.args, self.executables, "warm")
        self.assertEqual(destination.read_bytes(), b"previous output")
        self.assertFalse(list(destination.parent.glob(".enhance-*")))
        self.assertEqual(self.input.read_bytes(), self.before)

    def test_preview_identical_fragment_duration_for_all_profiles(self):
        self.assertEqual(self.invoke("preview", "rv1909", "--file", self.input.name, "--start", "2", "--seconds", "4"), 0)
        directory = self.output / "rv1909" / "_previews" / self.input.stem
        for preset in ("original", *cli.PRESETS):
            info = cli.probe(self.executables[1], directory / (preset + ".wav"))
            self.assertAlmostEqual(info["duration"], 4, delta=0.03)
        self.assertEqual(self.input.read_bytes(), self.before)

    def test_preview_path_traversal_rejected(self):
        self.assertEqual(self.invoke("preview", "rv1909", "--file", "../other.wav"), 1)
        self.assertFalse(self.output.exists())

    def test_preview_label_traversal_rejected(self):
        self.assertEqual(self.invoke("preview", "rv1909", "--file", self.input.name, "--label", "../outside"), 1)
        self.assertFalse(self.output.exists())

    def test_stronger_presets_have_greater_low_to_high_balance(self):
        self.assertEqual(self.invoke("preview", "rv1909", "--file", self.input.name,
                                     "--start", "0", "--seconds", "8", "--presets", "warm", "full", "dark",
                                     "--label", "strong"), 0)
        directory = self.output / "rv1909" / "_previews" / self.input.stem / "strong"
        ratios = []
        for preset in ("warm", "full", "dark"):
            result = subprocess.run([self.executables[0], "-v", "error", "-i", str(directory / f"{preset}.wav"),
                                     "-ss", "1", "-t", "1", "-f", "f64le", "-"], check=True, capture_output=True)
            samples = array("d", result.stdout)
            if sys.byteorder == "big":
                samples.byteswap()
            powers = []
            for frequency in (120, 3200):
                real = sum(value * math.cos(2 * math.pi * frequency * index / 48000)
                           for index, value in enumerate(samples))
                imag = sum(value * math.sin(2 * math.pi * frequency * index / 48000)
                           for index, value in enumerate(samples))
                powers.append(real * real + imag * imag)
            ratios.append(10 * math.log10(powers[0] / powers[1]))
        self.assertGreater(ratios[1] - ratios[0], 4)
        self.assertGreater(ratios[2] - ratios[1], 3)
        self.assertFalse((directory / "gentle.wav").exists())

    def test_pitch_changes_frequency_preserves_tempo_and_reference(self):
        tone = self.source / "tone.wav"
        cli.run([self.executables[0], "-v", "error", "-f", "lavfi", "-i",
                 "sine=frequency=440:duration=8:sample_rate=48000", str(tone)])
        for semitones in (-1, -3):
            label = f"pitch{abs(semitones)}"
            self.assertEqual(self.invoke("preview", "rv1909", "--file", tone.name, "--start", "0", "--seconds", "8",
                                         "--presets", "full", "--strength", "0", "--pitch-semitones", str(semitones),
                                         "--label", label), 0)
            directory = self.output / "rv1909" / "_previews" / tone.stem / label
            for preset in ("original", "full"):
                output = directory / f"{preset}.wav"
                self.assertAlmostEqual(cli.probe(self.executables[1], output)["duration"], 8, delta=0.08)
                result = subprocess.run([self.executables[0], "-v", "error", "-i", str(output),
                                         "-ss", "1", "-t", "1", "-f", "s16le", "-"], check=True, capture_output=True)
                samples = array("h", result.stdout)
                if sys.byteorder == "big":
                    samples.byteswap()
                crossings = sum(a <= 0 < b for a, b in zip(samples, samples[1:]))
                expected = 440 if preset == "original" else 440 * 2 ** (semitones / 12)
                self.assertAlmostEqual(crossings, expected, delta=2)
                report = json.loads(output.with_suffix(".wav.json").read_text())
                self.assertEqual(report["settings"]["pitch_semitones"], 0 if preset == "original" else semitones)
        self.assertEqual(self.input.read_bytes(), self.before)

    def test_same_stem_collision_rejected(self):
        (self.source / self.input.with_suffix(".mp3").name).touch()
        self.assertEqual(self.invoke("enhance", "rv1909", "--dry-run"), 1)
        self.assertFalse(self.output.exists())

    def test_mp3_and_flac_encoders(self):
        for output_format in ("mp3", "flac"):
            with self.subTest(format=output_format):
                self.assertEqual(self.invoke("enhance", "rv1909", "--format", output_format), 0)
                output = self.output / "rv1909" / self.input.with_suffix("." + output_format).name
                self.assertAlmostEqual(cli.probe(self.executables[1], output)["duration"], 8, delta=0.1)


if __name__ == "__main__":
    unittest.main()
