import argparse
import shutil
import sys
import tempfile
import types
import unittest
import wave
from pathlib import Path
from unittest.mock import patch
from cli import generate
from speech_chunks import speech_chunks


class SpeechChunkTests(unittest.TestCase):
    def test_complete_multilingual_text_is_preserved_with_bounded_fragments(self):
        for sentence in ("Así creó Dios los cielos y la tierra.", "In the beginning God created heaven and earth.", "No princípio Deus criou os céus e a terra."):
            text = "\n".join([sentence * 4, sentence, " ".join(["palabra"] * 100)])
            chunks = speech_chunks(text)
            self.assertEqual(" ".join(text.split()), " ".join(chunks))
            self.assertTrue(all(len(chunk) <= 220 and len(chunk.split()) <= 35 for chunk in chunks))
        self.assertEqual(speech_chunks("Primero.\nSegundo; tercero."), ["Primero.", "Segundo; tercero."])

    @unittest.skipUnless(shutil.which("ffmpeg"), "FFmpeg required")
    def test_fragments_form_one_audio_with_all_text_and_identical_voice_controls(self):
        class Waveform:
            shape = (1, 2400)
            def cpu(self): return self
        calls = []
        def synthesize(**kwargs):
            calls.append(kwargs)
            waveform = Waveform()
            if len(kwargs["text"].split()) > 35:
                waveform.shape = (1, 960000)
            return waveform
        def save(filename, waveform, sample_rate):
            with wave.open(filename, "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(sample_rate)
                output.writeframes(bytes(2400 * 2))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            prompt = root / "reference.mp3"
            prompt.touch()
            args = argparse.Namespace(output_dir=root, voice_prompt=prompt, model="latam", language="es", force=True, device="cpu", exaggeration=0.5, cfg_weight=0.3, temperature=0.8, min_p=0.05, top_p=1.0, repetition_penalty=2)
            text = "\n".join(["Lectura completa del pasaje con una voz clara y pausada." for _ in range(8)])
            with patch.dict(sys.modules, {"torchaudio": types.SimpleNamespace(save=save)}), patch("cli.load_model", return_value=types.SimpleNamespace(sr=24000, generate=synthesize)):
                generate(args, {"intro": text}, {})
            self.assertEqual(" ".join(text.split()), " ".join(call["text"] for call in calls))
            for call in calls:
                self.assertEqual(call["audio_prompt_path"], str(prompt))
                self.assertEqual(call["cfg_weight"], 0.3)
                self.assertEqual(call["repetition_penalty"], 2)
                self.assertEqual(call["language_id"], "es")
            with wave.open(str(root / "intro.wav")) as output:
                self.assertAlmostEqual(output.getnframes() / output.getframerate(), 0.1 * len(calls), places=3)
            self.assertEqual((root / "intro.txt").read_text().strip(), text)

    def test_capped_audio_never_replaces_an_existing_recording(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "intro.wav").write_bytes(b"previous")
            args = argparse.Namespace(output_dir=root, voice_prompt=None, model="latam", language="es", force=True, device="cpu", exaggeration=0.5, cfg_weight=0.3)
            model = types.SimpleNamespace(sr=24000, generate=lambda **kwargs: types.SimpleNamespace(shape=(1, 960000)))
            with patch.dict(sys.modules, {"torchaudio": types.SimpleNamespace()}), patch("cli.load_model", return_value=model), self.assertRaisesRegex(RuntimeError, "VOICE_TRUNCATED"):
                generate(args, {"intro": "Texto"}, {})
            self.assertEqual((root / "intro.wav").read_bytes(), b"previous")

    def test_single_utterance_keeps_an_entire_verse_in_one_model_request(self):
        class Waveform:
            shape = (1, 24000)
            def cpu(self): return self
        calls = []
        def synthesize(**kwargs): calls.append(kwargs); return Waveform()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            args = argparse.Namespace(output_dir=root, voice_prompt=None, model="latam", language="es", force=True, device="cpu", exaggeration=0.5, cfg_weight=0.3, single_utterance=True)
            text = " ".join(["palabra"] * 50)
            with patch.dict(sys.modules, {"torchaudio": types.SimpleNamespace(save=lambda filename,*args: Path(filename).write_bytes(b"native"))}), patch("cli.load_model",return_value=types.SimpleNamespace(sr=24000,generate=synthesize)), patch("cli.convert_audio",side_effect=lambda source,target,codec:target.write_bytes(b"wav")):
                generate(args,{"intro":text},{})
            self.assertEqual([call["text"] for call in calls],[text])


if __name__ == "__main__":
    unittest.main()
