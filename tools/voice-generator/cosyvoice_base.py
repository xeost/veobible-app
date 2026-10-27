"""CosyVoice 3 Base/RL adapter; shared HF weights are always read-only."""
from functools import partial
from pathlib import Path
import os
import sys

REPOSITORY = "FunAudioLLM/Fun-CosyVoice3-0.5B-2512"
CHECKPOINTS = {"cosyvoice3-base-0.5b": "llm.pt", "cosyvoice3-rl-0.5b": "llm.rl.pt"}
COMMON_FILES = ["cosyvoice3.yaml", "flow.pt", "hift.pt", "campplus.onnx", "speech_tokenizer_v3.onnx", "CosyVoice-BlankEN/config.json", "CosyVoice-BlankEN/generation_config.json", "CosyVoice-BlankEN/tokenizer_config.json", "CosyVoice-BlankEN/merges.txt", "CosyVoice-BlankEN/vocab.json"]
SOURCE_REVISION = "074ca6dc9e80a2f424f1f74b48bdd7d3fea531cc"
PREFIX = "You are a helpful assistant."
END_PROMPT = "<|endofprompt|>"


def cached_snapshot(kind):
    from huggingface_hub import snapshot_download
    from huggingface_hub.errors import LocalEntryNotFoundError
    required = [*COMMON_FILES, CHECKPOINTS[kind]]
    try:
        snapshot = Path(snapshot_download(repo_id=REPOSITORY, local_files_only=True))
        if all((snapshot / name).is_file() for name in required):
            return snapshot
    except LocalEntryNotFoundError:
        pass
    return Path(snapshot_download(repo_id=REPOSITORY, allow_patterns=required, max_workers=2))


def config_only_qwen_encoder(pretrain_path):
    """The chosen llm checkpoint supplies every encoder tensor (strict loading)."""
    import torch
    from transformers import AutoConfig, Qwen2ForCausalLM
    from cosyvoice.llm.llm import Qwen2Encoder
    encoder = Qwen2Encoder.__new__(Qwen2Encoder)
    torch.nn.Module.__init__(encoder)
    encoder.model = Qwen2ForCausalLM(AutoConfig.from_pretrained(pretrain_path, local_files_only=True))
    return encoder


def load_cosyvoice_weights(engine, snapshot, checkpoint):
    import torch
    for module, filename in [(engine.llm, checkpoint), (engine.flow, "flow.pt"), (engine.hift, "hift.pt")]:
        state = torch.load(snapshot / filename, map_location="cpu", weights_only=True, mmap=True)
        if filename == "hift.pt":
            state = {key.removeprefix("generator."): value for key, value in state.items()}
        # Assign mapped tensors instead of allocating a second complete model copy.
        # Strict loading still rejects missing or incompatible weights.
        module.load_state_dict(state, strict=True, assign=True)
        module.to(engine.device).eval()
        del state


def inference_definition(definition):
    """Keep inference roots and their references, without constructing training objects."""
    import re
    import yaml
    document = yaml.compose(definition)
    if not isinstance(document, yaml.MappingNode):
        raise RuntimeError("Invalid CosyVoice configuration")
    entries = {key.value: value for key, value in document.value}
    required = {"llm", "flow", "hift", "get_tokenizer", "feat_extractor", "allowed_special", "sample_rate"}
    if not required.issubset(entries):
        raise RuntimeError("Incomplete CosyVoice inference configuration")
    required.update(key for key in entries if key.startswith("__set_seed"))
    def references(node):
        if isinstance(node, yaml.ScalarNode):
            return set(re.findall(r"<([A-Za-z_][A-Za-z_0-9]*)", node.value)) if node.tag == "!ref" else set()
        values = [value for _, value in node.value] if isinstance(node, yaml.MappingNode) else node.value
        return set().union(*(references(value) for value in values))
    while True:
        expanded = required | set().union(*(references(entries[key]) for key in required))
        if not expanded.issubset(entries):
            raise RuntimeError("Missing CosyVoice configuration dependency")
        if expanded == required:
            break
        required = expanded
    document.value = [(key, value) for key, value in document.value if key.value in required]
    return yaml.serialize(document)


def load_cosyvoice(kind, device):
    if device not in ("auto", "cpu", "cuda"):
        raise ValueError("CosyVoice 3 supports CPU or CUDA; MPS is not supported by this adapter")
    if device == "cpu":
        os.environ["CUDA_VISIBLE_DEVICES"] = ""
    source = Path(os.environ.get("VIDEO_COSYVOICE_SOURCE", Path(__file__).parent / ".cosyvoice-src"))
    if not (source / "cosyvoice/cli/cosyvoice.py").is_file():
        raise RuntimeError("CosyVoice source is missing; run setup-cosyvoice.py")
    sys.path[:0] = [str(source), str(source / "third_party/Matcha-TTS")]
    import torch
    from hyperpyyaml import load_hyperpyyaml
    from cosyvoice.cli.cosyvoice import CosyVoice3
    from cosyvoice.cli.frontend import CosyVoiceFrontEnd
    from cosyvoice.cli.model import CosyVoice3Model
    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable")
    snapshot = cached_snapshot(kind)
    definition = (snapshot / "cosyvoice3.yaml").read_text(encoding="utf-8")
    tag = "!new:cosyvoice.llm.llm.Qwen2Encoder"
    if definition.count(tag) != 1:
        raise RuntimeError("CosyVoice architecture changed; review the model configuration before loading")
    definition = definition.replace(tag, "!apply:cosyvoice_base.config_only_qwen_encoder")
    config = load_hyperpyyaml(inference_definition(definition), overrides={"qwen_pretrain_path": str(snapshot / "CosyVoice-BlankEN")})
    # The official constructor always loads llm.pt. Build with the chosen LLM
    # directly, avoiding double loading and never swapping files in the HF cache.
    model = CosyVoice3.__new__(CosyVoice3)
    model.model_dir, model.fp16 = str(snapshot), False
    model.sample_rate = config["sample_rate"]
    model.frontend = CosyVoiceFrontEnd(config["get_tokenizer"], config["feat_extractor"], str(snapshot / "campplus.onnx"), str(snapshot / "speech_tokenizer_v3.onnx"), "", config["allowed_special"])
    model.model = CosyVoice3Model(config["llm"], config["flow"], config["hift"], False)
    load_cosyvoice_weights(model.model, snapshot, CHECKPOINTS[kind])
    # A capped decoder must fail the sample instead of publishing partial speech.
    original = model.model.llm.inference_wrapper
    model._generation_capped = False
    def checked_decode(lm_input, sampling, min_len, max_len, uuid):
        count = 0
        for token in original(lm_input, sampling, min_len, max_len, uuid):
            count += 1
            yield token
        if count >= max_len:
            model._generation_capped = True
    model.model.llm.inference_wrapper = checked_decode
    return model


def synthesize_cosyvoice(model, text, language, reference, args):
    import numpy as np
    import torch
    from cosyvoice.utils.common import ras_sampling, set_all_random_seed
    if language not in ("en", "es"):
        raise ValueError("CosyVoice 3 is enabled only for English and Spanish")
    if reference is None or not Path(reference).is_file():
        raise ValueError("CosyVoice 3 requires a base voice recording")
    set_all_random_seed(args.seed)
    model.model.llm.sampling = partial(ras_sampling, top_p=args.top_p, top_k=args.top_k, win_size=args.win_size, tau_r=args.tau_r)
    model._generation_capped = False
    options = {"stream": False, "speed": args.speed, "text_frontend": False}
    if args.mode == "zero_shot":
        transcript = Path(reference).with_suffix(".txt")
        if not transcript.is_file() or not transcript.read_text(encoding="utf-8").strip():
            raise ValueError("This cloning mode requires the exact base voice transcript in its .txt sidecar")
        output = model.inference_zero_shot(text, PREFIX + END_PROMPT + transcript.read_text(encoding="utf-8").strip(), str(reference), **options)
    elif args.mode == "instruct":
        if not args.instructions.strip() or any(char in args.instructions for char in "<>|"):
            raise ValueError("Enter narration instructions without special control tokens")
        output = model.inference_instruct2(text, PREFIX + " " + args.instructions.strip() + END_PROMPT, str(reference), **options)
    elif args.mode == "cross_lingual":
        output = model.inference_cross_lingual(PREFIX + END_PROMPT + text, str(reference), **options)
    else:
        raise ValueError("Unknown CosyVoice cloning mode")
    waves = [item["tts_speech"].detach().cpu() for item in output]
    if model._generation_capped:
        raise RuntimeError("VOICE_TRUNCATED: speech reached its generation limit")
    if not waves:
        raise RuntimeError("CosyVoice returned empty audio")
    wave = torch.cat(waves, dim=-1).squeeze(0).numpy()
    if wave.ndim != 1 or not wave.size or not np.isfinite(wave).all():
        raise RuntimeError("CosyVoice returned invalid audio")
    return wave, model.sample_rate
