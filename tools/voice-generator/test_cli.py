import json
import argparse
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from cli import generate, main, read_voice_prompts, voice_prompt_for_track


class VoicePromptTests(unittest.TestCase):
    def test_each_track_uses_its_own_sample_with_shared_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            intro = root / "es-intro.mp3"
            fallback = root / "es.mp3"
            intro.touch()
            fallback.touch()
            mapping = root / "voice-prompts.json"
            mapping.write_text(json.dumps({"intro": str(intro)}), encoding="utf-8")

            prompts = read_voice_prompts(mapping, {"intro": "Hola", "outro": "Adiós"})
            self.assertEqual(voice_prompt_for_track("intro", prompts, fallback), intro)
            self.assertEqual(voice_prompt_for_track("outro", prompts, fallback), fallback)

    def test_rejects_missing_sample(self):
        with tempfile.TemporaryDirectory() as directory:
            mapping = Path(directory) / "voice-prompts.json"
            mapping.write_text(json.dumps({"intro": str(Path(directory) / "missing.mp3")}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Voice prompt for intro does not exist"):
                read_voice_prompts(mapping, {"intro": "Hola"})

    def test_generation_keeps_only_wav_and_script(self):
        class Waveform:
            def cpu(self):
                return self

        class Model:
            sr = 24000

            def generate(self, **kwargs):
                return Waveform()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            args = argparse.Namespace(output_dir=root, voice_prompt=None, model="multilingual", language="es", force=True, device="cpu", exaggeration=0.5, cfg_weight=0.5)
            (root / "intro.aiff").write_bytes(b"old format")
            fake_torchaudio = types.SimpleNamespace(save=lambda filename, waveform, sample_rate: Path(filename).write_bytes(b"native audio"))
            with patch.dict(sys.modules, {"torchaudio": fake_torchaudio}), patch("cli.load_model", return_value=Model()), patch("cli.convert_audio", side_effect=lambda source, target, codec: target.write_bytes(b"converted wav")) as convert:
                generate(args, {"intro": "Hola", "outro": "Adiós"}, {})
            self.assertEqual(convert.call_count, 2)
            self.assertEqual(sorted(file.name for file in root.iterdir()), ["intro.txt", "intro.wav", "outro.txt", "outro.wav"])

    def test_supervisor_failure_cleans_only_owned_staging_and_preserves_existing_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "scripts.json"
            scripts.write_text(json.dumps({"intro": "Hello"}))
            output = root / "audio"
            output.mkdir()
            (output / "intro.wav").write_bytes(b"existing")
            unrelated = output / ".voice-other-job"
            unrelated.mkdir()

            def fail(command, limits, lock_fd):
                self.assertEqual(limits.profile, "low")
                staging = Path(command[command.index("--staging-dir") + 1])
                (staging / "partial.wav").write_bytes(b"partial")
                raise RuntimeError("VOICE_RESOURCE_LIMIT: memory limit")

            argv = ["cli.py", "--scripts", str(scripts), "--language", "en", "--output-dir", str(output), "--force", "--resource-profile", "low"]
            with patch.object(sys, "argv", argv), patch("resources.supervise", side_effect=fail):
                self.assertEqual(main(), 1)
            self.assertEqual((output / "intro.wav").read_bytes(), b"existing")
            self.assertEqual(sorted(path.name for path in output.iterdir()), [".voice-other-job", "intro.wav"])

    def test_low_profile_resolves_auto_to_cpu_before_model_loading(self):
        with tempfile.TemporaryDirectory() as directory:
            scripts = Path(directory) / "scripts.json"
            scripts.write_text(json.dumps({"intro": "Hello"}))
            argv = ["cli.py", "--scripts", str(scripts), "--language", "en", "--output-dir", directory, "--resource-profile", "low", "--worker"]
            with patch.object(sys, "argv", argv), patch("resources.configure_worker") as configure, patch("cli.generate"):
                self.assertEqual(main(), 0)
                self.assertEqual(configure.call_args.args[1], "cpu")


if __name__ == "__main__":
    unittest.main()
