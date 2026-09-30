import json
import tempfile
import unittest
from pathlib import Path

from cli import read_voice_prompts, voice_prompt_for_track


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


if __name__ == "__main__":
    unittest.main()
