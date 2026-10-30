"""Official Hugging Face Qwen Base adapter, isolated from Chatterbox dependencies."""
from pathlib import Path

QWEN_MODELS = {
    "qwen3-base-0.6b": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    "qwen3-base-1.7b": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
}
LANGUAGES = {"en": "English", "es": "Spanish", "pt": "Portuguese"}
REQUIRED_FILES = (
    "config.json", "generation_config.json", "model.safetensors",
    "tokenizer_config.json", "vocab.json", "merges.txt", "preprocessor_config.json",
    "speech_tokenizer/config.json", "speech_tokenizer/model.safetensors",
    "speech_tokenizer/preprocessor_config.json",
)


def load_qwen(kind, device):
    import torch
    from qwen_tts import Qwen3TTSModel
    from huggingface_hub import snapshot_download
    from huggingface_hub.errors import LocalEntryNotFoundError

    repository = QWEN_MODELS[kind]
    try:
        snapshot = Path(snapshot_download(repo_id=repository, local_files_only=True))
        if not all((snapshot / file).is_file() for file in REQUIRED_FILES):
            snapshot = Path(snapshot_download(repo_id=repository))
    except LocalEntryNotFoundError:
        snapshot = Path(snapshot_download(repo_id=repository))
    if device == "auto":
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
    # MPS does not support bfloat16 consistently across supported macOS versions.
    dtype = torch.float32 if device == "mps" else torch.bfloat16
    # A local path avoids the upstream loader's extra network lookup for its tokenizer.
    return Qwen3TTSModel.from_pretrained(
        str(snapshot), device_map=device, dtype=dtype, attn_implementation="sdpa",
    )


def synthesize_qwen(model, text, language, reference, args):
    import numpy as np

    if reference is None:
        raise ValueError("Qwen Base requires a base voice recording")
    # Sidecars must transcribe the permanent reference, not the target text.
    # Without one, use the officially supported speaker-embedding mode.
    transcript = Path(reference).with_suffix(".txt")
    ref_text = transcript.read_text(encoding="utf-8").strip() if transcript.is_file() else None
    options = {
        key: getattr(args, key)
        for key in ("temperature", "top_p", "repetition_penalty")
        if getattr(args, key, None) is not None
    }
    prompt = prepared_clone_prompt(model, reference, ref_text, args.model)
    waves, rate = model.generate_voice_clone(
        text=text, language=LANGUAGES[language], voice_clone_prompt=prompt,
        top_k=args.top_k, max_new_tokens=args.max_new_tokens, **options,
    )
    if not waves or not isinstance(rate, (int, float)) or rate <= 0:
        raise RuntimeError("Qwen returned empty or invalid audio")
    wave = np.asarray(waves[0])
    if wave.ndim != 1 or not wave.size or not np.isfinite(wave).all():
        raise RuntimeError("Qwen returned empty or invalid audio")
    # The 12 Hz codec emits one frame per speech token. Never publish capped speech.
    if len(wave) / rate >= (args.max_new_tokens - 1) / 12:
        raise RuntimeError("VOICE_TRUNCATED: speech reached its generation limit")
    return wave, rate


def prepared_clone_prompt(model, reference, transcript, kind):
    """Cache derived reference features, never model weights or target speech."""
    import pickle
    import hashlib
    import os
    import tempfile
    from dataclasses import asdict
    import torch
    from qwen_tts.inference.qwen3_tts_model import VoiceClonePromptItem
    from importlib.metadata import version

    digest = hashlib.sha256(Path(reference).read_bytes())
    digest.update((kind + version("qwen-tts") + (transcript or "")).encode())
    root = Path(tempfile.gettempdir()) / f"veobible-qwen-prompts-{os.getuid()}"
    root.mkdir(mode=0o700, exist_ok=True)
    cache = root / (digest.hexdigest() + ".pt")
    try:
        items = torch.load(cache, map_location=model.device, weights_only=True)
        return [VoiceClonePromptItem(**item) for item in items]
    except (OSError, ValueError, RuntimeError, TypeError, EOFError, pickle.UnpicklingError):
        pass
    items = model.create_voice_clone_prompt(ref_audio=str(reference), ref_text=transcript or None,
                                          x_vector_only_mode=not bool(transcript))
    data = [{key: value.detach().cpu() if isinstance(value, torch.Tensor) else value
             for key, value in asdict(item).items()} for item in items]
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=root, delete=False) as handle:
            temporary = Path(handle.name)
            torch.save(data, handle)
        temporary.replace(cache)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return items
