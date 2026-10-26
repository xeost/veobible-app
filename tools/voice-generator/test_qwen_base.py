import argparse
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
import numpy as np
from qwen_base import LANGUAGES, synthesize_qwen


class QwenBaseTests(unittest.TestCase):
    def args(self):
        return argparse.Namespace(temperature=0.75, top_p=0.8, repetition_penalty=1.05, top_k=35, max_new_tokens=128)

    def test_all_languages_reuse_reference_and_forward_only_qwen_controls(self):
        with tempfile.TemporaryDirectory() as directory:
            reference = Path(directory) / 'es-1.mp3'
            reference.write_bytes(b'permanent reference')
            for locale, language in LANGUAGES.items():
                model = Mock()
                model.generate_voice_clone.return_value = ([np.zeros(24000)], 24000)
                audio, rate = synthesize_qwen(model, 'Complete verse.', locale, reference, self.args())
                self.assertEqual(rate, 24000)
                request = model.generate_voice_clone.call_args.kwargs
                self.assertEqual(request['language'], language)
                self.assertEqual(request['ref_audio'], str(reference))
                self.assertTrue(request['x_vector_only_mode'])
                self.assertEqual(request['temperature'], 0.75)
                self.assertNotIn('exaggeration', request)
                self.assertNotIn('cfg_weight', request)
                self.assertEqual(reference.read_bytes(), b'permanent reference')
            reference.with_suffix('.txt').write_text('Exact words from the sample.', encoding='utf-8')
            synthesize_qwen(model, 'Another verse.', 'es', reference, self.args())
            request = model.generate_voice_clone.call_args.kwargs
            self.assertFalse(request['x_vector_only_mode'])
            self.assertEqual(request['ref_text'], 'Exact words from the sample.')

    def test_invalid_or_capped_audio_is_never_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            reference = Path(directory) / 'en-1.mp3'
            reference.touch()
            for wave in [np.array([]), np.array([float('nan')]), np.zeros(24000 * 11)]:
                model = Mock()
                model.generate_voice_clone.return_value = ([wave], 24000)
                with self.assertRaises(RuntimeError):
                    synthesize_qwen(model, 'Text', 'en', reference, self.args())

    def test_cached_snapshots_load_by_local_path_without_contacting_hugging_face(self):
        import sys
        from types import SimpleNamespace
        from unittest.mock import patch
        from qwen_base import load_qwen
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory)
            for name in ('config.json', 'generation_config.json', 'model.safetensors', 'tokenizer_config.json', 'vocab.json', 'merges.txt', 'preprocessor_config.json', 'speech_tokenizer/config.json', 'speech_tokenizer/model.safetensors', 'speech_tokenizer/preprocessor_config.json'):
                file = snapshot / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.touch()
            download = Mock(return_value=directory)
            model_class = Mock()
            class MissingCache(Exception):
                pass
            with patch.dict(sys.modules, {
                'torch': SimpleNamespace(float32='f32', bfloat16='bf16'),
                'qwen_tts': SimpleNamespace(Qwen3TTSModel=model_class),
                'huggingface_hub': SimpleNamespace(snapshot_download=download),
                'huggingface_hub.errors': SimpleNamespace(LocalEntryNotFoundError=MissingCache),
            }):
                for model in ('qwen3-base-0.6b', 'qwen3-base-1.7b'):
                    load_qwen(model, 'cpu')
                    self.assertEqual(model_class.from_pretrained.call_args.args, (directory,))
                    self.assertTrue(download.call_args.kwargs['local_files_only'])

    def test_downloader_uses_the_shared_hugging_face_configuration(self):
        import os
        import runpy
        import sys
        from types import SimpleNamespace
        from unittest.mock import patch
        download = Mock(return_value='/shared/hub/snapshots/revision')
        with patch.dict(os.environ, {'HF_HOME': '/shared/huggingface'}):
            before = {key: os.environ.get(key) for key in ('HF_HOME', 'HF_HUB_CACHE', 'HUGGINGFACE_HUB_CACHE')}
            with patch.dict(sys.modules, {'huggingface_hub': SimpleNamespace(snapshot_download=download)}):
                runpy.run_path(str(Path(__file__).with_name('download-qwen.py')))
            after = {key: os.environ.get(key) for key in before}
            self.assertEqual(after, before)
        self.assertEqual(download.call_count, 2)
        for call in download.call_args_list:
            self.assertNotIn('cache_dir', call.kwargs)
