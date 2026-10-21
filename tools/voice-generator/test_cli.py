import json
import argparse
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from cli import generate, main, read_voice_prompts, voice_prompt_for_track, load_model, load_checkpoint_model


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
            shape = (1, 24000)
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
            from resources import generation_lock
            with patch.object(sys, "argv", argv), patch("resources.generation_lock", side_effect=lambda timeout: generation_lock(timeout, root / "test.lock")), patch("resources.supervise", side_effect=fail):
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


class ModelSelectionTests(unittest.TestCase):
    def test_alias_and_explicit_versions_reach_checkpoint_loader(self):
        fake_torch = types.SimpleNamespace()
        with patch.dict(sys.modules, {"torch": fake_torch}), patch("cli.load_checkpoint_model", return_value="model") as loader:
            for kind in ("multilingual", "multilingual-v3", "multilingual-v2", "latam", "pt-br"):
                self.assertEqual(load_model(kind, "cpu"), "model")
                loader.assert_called_with(kind, "cpu")
            with self.assertRaisesRegex(ValueError, "Unknown narration model"):
                load_model("unknown", "cpu")

    def test_loads_selected_weights_strictly_without_downloading_other_variants(self):
        from unittest.mock import MagicMock
        for kind, filename, audio_decoder in (("multilingual", "t3_mtl23ls_v3.safetensors", None), ("multilingual-v3", "t3_mtl23ls_v3.safetensors", None), ("multilingual-v2", "t3_mtl23ls_v2.safetensors", None), ("latam", "t3_es_mx_latam.safetensors", None), ("latam", "t3_es_mx_latam.safetensors", "general"), ("latam", "t3_es_mx_latam.safetensors", "v3"), ("pt-br", "t3_pt_br.safetensors", None), ("pt-br", "t3_pt_br.safetensors", "general"), ("pt-br", "t3_pt_br.safetensors", "v3"), ("multilingual-v3", "t3_mtl23ls_v3.safetensors", "general"), ("multilingual-v3", "t3_mtl23ls_v3.safetensors", "v3")):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                snapshot = MagicMock(side_effect=lambda repo_id, **kwargs: str(root / ("general" if repo_id == "ResembleAI/chatterbox" else "regional")))
                download = MagicMock(return_value=str(root / filename))
                load_weights = MagicMock(return_value={"weights": "selected"})
                t3 = MagicMock()
                decoder = MagicMock()
                decoder.return_value.load_state_dict.return_value = types.SimpleNamespace(missing_keys=[], unexpected_keys=[])
                modules = {
                    "torch": types.SimpleNamespace(device=lambda value: value, load=MagicMock(return_value={})),
                    "huggingface_hub": types.SimpleNamespace(snapshot_download=snapshot, hf_hub_download=download),
                    "safetensors.torch": types.SimpleNamespace(load_file=load_weights),
                    "chatterbox.models.s3gen": types.SimpleNamespace(S3Gen=decoder),
                    "chatterbox.models.t3": types.SimpleNamespace(T3=t3),
                    "chatterbox.models.t3.modules.t3_config": types.SimpleNamespace(T3Config=types.SimpleNamespace(multilingual=lambda: "multilingual-config")),
                    "chatterbox.models.tokenizers": types.SimpleNamespace(MTLTokenizer=MagicMock()),
                    "chatterbox.models.voice_encoder": types.SimpleNamespace(VoiceEncoder=MagicMock()),
                    "chatterbox.mtl_tts": types.SimpleNamespace(ChatterboxMultilingualTTS=MagicMock(), Conditionals=MagicMock()),
                }
                with patch.dict(sys.modules, modules):
                    load_checkpoint_model(kind, "cpu", audio_decoder)
                load_weights.assert_called_once_with(str(root / ("regional" if kind in ("latam", "pt-br") else "general") / filename))
                t3.return_value.load_state_dict.assert_called_once_with({"weights": "selected"})
                patterns = snapshot.call_args.kwargs["allow_patterns"]
                selected = [name for name in patterns if name.endswith(".safetensors")]
                self.assertEqual(selected, [filename])
                self.assertEqual(snapshot.call_count, 2 if kind in ("latam", "pt-br") else 1)
                if audio_decoder == "v3" or (kind == "pt-br" and audio_decoder is None):
                    self.assertIn("s3gen_v3.pt", patterns)
                    decoder_path = root / ("regional" if kind in ("latam", "pt-br") else "general") / "s3gen_v3.pt"
                    decoder.return_value.load_state_dict.assert_called_once_with({}, strict=False)
                else:
                    self.assertNotIn("s3gen_v3.pt", patterns)
                    self.assertIn("s3gen.pt", snapshot.call_args_list[0].kwargs["allow_patterns"])
                    decoder_path = root / "general" / "s3gen.pt"
                    decoder.return_value.load_state_dict.assert_called_once_with({})
                self.assertIn(unittest.mock.call(decoder_path, map_location="cpu", weights_only=True), modules["torch"].load.call_args_list)


class NarrationDispatchTests(unittest.TestCase):
    def test_original_english_loads_the_selected_decoder(self):
        from unittest.mock import MagicMock
        for selected, filename in (("general", "s3gen.pt"), ("v3", "s3gen_v3.pt")):
            with self.subTest(decoder=selected):
                english = MagicMock()
                decoder = MagicMock()
                decoder.return_value.load_state_dict.return_value = types.SimpleNamespace(missing_keys=[], unexpected_keys=[])
                download = MagicMock(return_value=filename)
                torch = types.SimpleNamespace(load=MagicMock(return_value={}))
                with patch.dict(sys.modules, {
                    "torch": torch,
                    "chatterbox.tts": types.SimpleNamespace(ChatterboxTTS=english),
                    "chatterbox.models.s3gen": types.SimpleNamespace(S3Gen=decoder),
                    "huggingface_hub": types.SimpleNamespace(hf_hub_download=download),
                }):
                    model = load_model("chatterbox", "cpu", selected)
                self.assertEqual(download.call_args.kwargs["filename"], filename)
                self.assertIs(model.s3gen, decoder.return_value.to.return_value.eval.return_value)
                if selected == "v3":
                    decoder.return_value.load_state_dict.assert_called_once_with({}, strict=False)
                else:
                    decoder.return_value.load_state_dict.assert_called_once_with({})

    def test_original_english_uses_its_own_loader(self):
        from unittest.mock import MagicMock
        english = MagicMock()
        with patch.dict(sys.modules, {"torch": types.SimpleNamespace(), "chatterbox.tts": types.SimpleNamespace(ChatterboxTTS=english)}), patch("cli.load_checkpoint_model") as multilingual:
            load_model("chatterbox", "cpu")
        english.from_pretrained.assert_called_once_with(device="cpu")
        multilingual.assert_not_called()

    def test_english_omits_language_id_while_regional_models_receive_it(self):
        from unittest.mock import MagicMock
        for kind, locale in (("chatterbox", "en"), ("latam", "es"), ("pt-br", "pt")):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                model = MagicMock(sr=24000)
                model.generate.return_value.shape = (1, 24000)
                args = argparse.Namespace(output_dir=root, voice_prompt=None, model=kind, language=locale, force=True, device="cpu", exaggeration=0.7, cfg_weight=0.3, temperature=0.7, min_p=0.05, top_p=1.0, repetition_penalty=1.2)
                audio = types.SimpleNamespace(save=lambda filename, *a: Path(filename).write_bytes(b"native"))
                with patch.dict(sys.modules, {"torchaudio": audio}), patch("cli.load_model", return_value=model), patch("cli.convert_audio", side_effect=lambda source, target, codec: target.write_bytes(b"converted")):
                    generate(args, {"intro": "Hello"}, {})
                kwargs = model.generate.call_args.kwargs
                for key, value in {"exaggeration": 0.7, "cfg_weight": 0.3, "temperature": 0.7, "min_p": 0.05, "top_p": 1.0, "repetition_penalty": 1.2}.items():
                    self.assertEqual(kwargs[key], value)
                if kind == "chatterbox": self.assertNotIn("language_id", kwargs)
                else: self.assertEqual(kwargs["language_id"], locale)

    def test_rejects_models_in_the_wrong_language_before_loading(self):
        from cli import validate_generation
        for kind, locale in (("chatterbox", "es"), ("latam", "en"), ("pt-br", "es")):
            args = argparse.Namespace(output_dir=Path(tempfile.gettempdir()), voice_prompt=None, model=kind, language=locale, force=True)
            with self.subTest(kind=kind), patch("cli.shutil.which", return_value="ffmpeg"), self.assertRaises(ValueError):
                validate_generation(args, {"intro": "Hello"})


class DecoderCompatibilityTests(unittest.TestCase):
    def test_only_computed_spectrogram_buffers_may_be_missing(self):
        from cli import load_decoder_state
        from unittest.mock import MagicMock
        decoder = MagicMock()
        decoder.load_state_dict.return_value = types.SimpleNamespace(missing_keys=["tokenizer.window", "tokenizer._mel_filters"], unexpected_keys=[])
        load_decoder_state(decoder, {}, True)
        for missing, unexpected in ((["decoder.learned_weight"], []), ([], ["unknown.weight"])):
            decoder.load_state_dict.return_value = types.SimpleNamespace(missing_keys=missing, unexpected_keys=unexpected)
            with self.assertRaisesRegex(RuntimeError, "Incompatible regional speech decoder"):
                load_decoder_state(decoder, {}, True)


if __name__ == "__main__":
    unittest.main()
