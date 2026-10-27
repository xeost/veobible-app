import argparse
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
import numpy as np
import torch
from cosyvoice_base import CHECKPOINTS, COMMON_FILES, END_PROMPT, REPOSITORY, cached_snapshot, load_cosyvoice, synthesize_cosyvoice


class CosyVoiceTests(unittest.TestCase):
    def args(self, **overrides):
        return argparse.Namespace(**{**dict(mode='cross_lingual', instructions='', speed=0.9, top_p=0.8, top_k=25, win_size=10, tau_r=0.1, seed=1986), **overrides})

    def test_modes_reuse_original_reference_and_disable_english_normalization(self):
        sampling, seed = Mock(), Mock()
        with patch.dict(sys.modules, {'cosyvoice.utils.common': SimpleNamespace(ras_sampling=sampling, set_all_random_seed=seed)}):
            with tempfile.TemporaryDirectory() as directory:
                reference = Path(directory) / 'es-1.mp3'
                reference.write_bytes(b'original')
                model = Mock(sample_rate=24000)
                for method in ('inference_cross_lingual', 'inference_zero_shot', 'inference_instruct2'):
                    getattr(model, method).return_value = [{'tts_speech': torch.zeros(1, 2400)}]
                for language in ('en', 'es'):
                    wave, rate = synthesize_cosyvoice(model, 'Text 123.', language, reference, self.args())
                    self.assertEqual(wave.shape, (2400,))
                    self.assertEqual(rate, 24000)
                    call = model.inference_cross_lingual.call_args
                    self.assertTrue(call.args[0].endswith(END_PROMPT + 'Text 123.'))
                    self.assertEqual(call.args[1], str(reference))
                    self.assertEqual(call.kwargs, dict(stream=False, speed=0.9, text_frontend=False))
                with self.assertRaises(ValueError):
                    synthesize_cosyvoice(model, 'Text', 'es', reference, self.args(mode='zero_shot'))
                reference.with_suffix('.txt').write_text('Exact reference words.', encoding='utf-8')
                synthesize_cosyvoice(model, 'Target words.', 'es', reference, self.args(mode='zero_shot'))
                self.assertTrue(model.inference_zero_shot.call_args.args[1].endswith(END_PROMPT + 'Exact reference words.'))
                synthesize_cosyvoice(model, 'Target words.', 'en', reference, self.args(mode='instruct', instructions='Speak calmly.'))
                self.assertIn('Speak calmly.', model.inference_instruct2.call_args.args[1])
                for language, args in [('pt', self.args()), ('en', self.args(mode='instruct')), ('en', self.args(mode='instruct', instructions='<|bad|>'))]:
                    with self.assertRaises(ValueError):
                        synthesize_cosyvoice(model, 'Text', language, reference, args)
                self.assertEqual(reference.read_bytes(), b'original')
                self.assertEqual(model.model.llm.sampling.keywords, dict(top_p=0.8, top_k=25, win_size=10, tau_r=0.1))
                for wave in [torch.tensor([[float('nan')]]), torch.zeros(1, 0)]:
                    model.inference_cross_lingual.return_value = [{'tts_speech': wave}]
                    with self.assertRaises(RuntimeError):
                        synthesize_cosyvoice(model, 'Text', 'en', reference, self.args())

    def test_base_and_rl_load_their_own_checkpoint_without_modifying_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'cosyvoice/cli').mkdir(parents=True)
            (root / 'cosyvoice/cli/cosyvoice.py').touch()
            (root / 'cosyvoice3.yaml').write_text('sample_rate: 24000\nllm: !new:cosyvoice.llm.llm.Qwen2Encoder\nflow: null\nhift: null\nget_tokenizer: null\nfeat_extractor: null\nallowed_special: all\n')
            fake = type('CosyVoice3', (), {})
            frontend, engine = Mock(), Mock()
            config = dict(sample_rate=24000, get_tokenizer='tokenizer', feat_extractor='features', allowed_special='all', llm='llm', flow='flow', hift='hift')
            with patch.dict('os.environ', {'VIDEO_COSYVOICE_SOURCE': directory}), patch('cosyvoice_base.load_cosyvoice_weights') as load, patch('cosyvoice_base.cached_snapshot', return_value=root), patch.dict(sys.modules, {
                'hyperpyyaml': SimpleNamespace(load_hyperpyyaml=Mock(return_value=config)),
                'cosyvoice.cli.cosyvoice': SimpleNamespace(CosyVoice3=fake),
                'cosyvoice.cli.frontend': SimpleNamespace(CosyVoiceFrontEnd=frontend),
                'cosyvoice.cli.model': SimpleNamespace(CosyVoice3Model=engine),
            }):
                for kind, checkpoint in CHECKPOINTS.items():
                    load_cosyvoice(kind, 'cpu')
                    self.assertEqual(load.call_args.args, (engine.return_value, root, checkpoint))
            self.assertFalse((root / 'llm.pt').exists())

    def test_qwen_encoder_is_constructed_from_configuration_not_redundant_weights(self):
        from cosyvoice_base import config_only_qwen_encoder
        class Encoder(torch.nn.Module):
            pass
        config, factory = Mock(), Mock()
        with patch.dict(sys.modules, {
            'transformers': SimpleNamespace(AutoConfig=SimpleNamespace(from_pretrained=config), Qwen2ForCausalLM=factory),
            'cosyvoice.llm.llm': SimpleNamespace(Qwen2Encoder=Encoder),
        }):
            encoder = config_only_qwen_encoder('/shared/snapshot/CosyVoice-BlankEN')
            config.assert_called_once_with('/shared/snapshot/CosyVoice-BlankEN', local_files_only=True)
            factory.assert_called_once_with(config.return_value)
            self.assertIs(encoder.model, factory.return_value)

    def test_mapped_loading_is_strict_and_keeps_cached_files_unchanged(self):
        from cosyvoice_base import load_cosyvoice_weights
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            engine = SimpleNamespace(llm=torch.nn.Linear(2, 2), flow=torch.nn.Linear(2, 2), hift=torch.nn.Linear(2, 2), device=torch.device('cpu'))
            expected = {'weight': torch.full((2, 2), 0.25), 'bias': torch.ones(2)}
            for name in ('llm.rl.pt', 'flow.pt', 'hift.pt'):
                torch.save({('generator.' + key if name == 'hift.pt' else key): value for key, value in expected.items()}, root / name)
            before = {file.name: file.read_bytes() for file in root.iterdir()}
            load_cosyvoice_weights(engine, root, 'llm.rl.pt')
            for module in (engine.llm, engine.flow, engine.hift):
                torch.testing.assert_close(module.weight, expected['weight'])
                torch.testing.assert_close(module.bias, expected['bias'])
                self.assertFalse(module.training)
            self.assertEqual(before, {file.name: file.read_bytes() for file in root.iterdir()})
            torch.save({'bias': torch.ones(2)}, root / 'llm.rl.pt')
            with self.assertRaises(RuntimeError):
                load_cosyvoice_weights(engine, root, 'llm.rl.pt')

    def test_inference_config_keeps_transitive_references_without_importing_training_code(self):
        from cosyvoice_base import inference_definition
        from hyperpyyaml import load_hyperpyyaml
        definition = """sample_rate: 24000
width: 4
llm: !ref <width>
flow: null
hift: null
get_tokenizer: null
feat_extractor: null
allowed_special: all
training_only: !new:this.module.must.not.be.imported
"""
        filtered = inference_definition(definition)
        self.assertNotIn('training_only', filtered)
        self.assertEqual(load_hyperpyyaml(filtered)['llm'], 4)
        with self.assertRaises(RuntimeError):
            inference_definition('llm: null')

    def test_downloader_preserves_shared_hugging_face_configuration(self):
        import os
        import runpy
        download = Mock(return_value='/shared/hub/snapshots/revision')
        with patch.dict(os.environ, {'HF_HOME': '/shared/huggingface'}):
            before = {key: os.environ.get(key) for key in ('HF_HOME', 'HF_HUB_CACHE', 'HUGGINGFACE_HUB_CACHE')}
            with patch.dict(sys.modules, {'huggingface_hub': SimpleNamespace(snapshot_download=download)}):
                runpy.run_path(str(Path(__file__).with_name('download-cosyvoice.py')), run_name='__main__')
            self.assertEqual(before, {key: os.environ.get(key) for key in before})
        self.assertEqual(download.call_args.kwargs['repo_id'], REPOSITORY)
        self.assertNotIn('cache_dir', download.call_args.kwargs)
        self.assertNotIn('local_dir', download.call_args.kwargs)
        self.assertTrue(set(CHECKPOINTS.values()).issubset(download.call_args.kwargs['allow_patterns']))

    def test_cached_snapshot_uses_standard_shared_hf_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for file in [*COMMON_FILES, *CHECKPOINTS.values()]:
                path = root / file
                path.parent.mkdir(parents=True, exist_ok=True)
                path.touch()
            download = Mock(return_value=directory)
            with patch.dict(sys.modules, {'huggingface_hub': SimpleNamespace(snapshot_download=download), 'huggingface_hub.errors': SimpleNamespace(LocalEntryNotFoundError=type('Missing', (Exception,), {}))}):
                for model in CHECKPOINTS:
                    self.assertEqual(cached_snapshot(model), root)
                    self.assertEqual(download.call_args.kwargs, dict(repo_id=REPOSITORY, local_files_only=True))


if __name__ == '__main__':
    unittest.main()
