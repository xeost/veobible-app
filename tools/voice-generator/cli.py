#!/usr/bin/env python3
"""Synthesize any named collection of text tracks with Chatterbox."""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import signal
from contextlib import nullcontext
from pathlib import Path
from speech_chunks import speech_chunks


# Keep Numba's cache in a writable location independent of the active venv.
os.environ.setdefault("NUMBA_CACHE_DIR", str(Path(tempfile.gettempdir()) / "veobible-voice-numba"))


import re

TRACK_NAME = re.compile(r"^[a-z][a-z0-9_-]*$")


def read_scripts(scripts_path: Path) -> dict[str, str]:
    scripts = json.loads(scripts_path.read_text(encoding="utf-8"))
    if not isinstance(scripts, dict) or not scripts:
        raise ValueError("The scripts file must contain a non-empty JSON object")
    for name, script in scripts.items():
        if not isinstance(name, str) or not TRACK_NAME.fullmatch(name):
            raise ValueError(f"Invalid track name: {name}")
        if not isinstance(script, str) or not script.strip():
            raise ValueError(f"Empty or invalid text for track {name}")
    return {name: script.strip() for name, script in scripts.items()}


def read_voice_prompts(prompts_path: Path | None, scripts: dict[str, str]) -> dict[str, Path]:
    if prompts_path is None:
        return {}
    prompts = json.loads(prompts_path.read_text(encoding="utf-8"))
    if not isinstance(prompts, dict):
        raise ValueError("Voice prompts must be a JSON object")
    result = {}
    for track, filename in prompts.items():
        if track not in scripts or not isinstance(filename, str) or not filename.strip():
            raise ValueError(f"Invalid voice prompt for track {track}")
        sample = Path(filename)
        if not sample.is_file():
            raise ValueError(f"Voice prompt for {track} does not exist: {sample}")
        result[track] = sample
    return result


def voice_prompt_for_track(track: str, voice_prompts: dict[str, Path], default: Path | None) -> Path | None:
    return voice_prompts.get(track, default)


def load_decoder_state(decoder, state, regional: bool):
    if not regional:
        decoder.load_state_dict(state)
        return
    # These deterministic spectrogram buffers are constructed by S3Tokenizer.
    # Official V3 language-pack decoders omit them; learned weights remain required.
    result = decoder.load_state_dict(state, strict=False)
    allowed = {"tokenizer._mel_filters", "tokenizer.window"}
    if set(result.missing_keys) - allowed or result.unexpected_keys:
        raise RuntimeError(f"Incompatible regional speech decoder: missing={result.missing_keys}, unexpected={result.unexpected_keys}")


def load_checkpoint_model(kind: str, device: str, audio_decoder: str | None = None):
    """Explicit T3 selection, compatible with chatterbox-tts 0.1.7.

    V2 and V3 use the upstream multilingual architecture and shared decoder.
    Do not call 0.1.7's from_pretrained: it silently selects V2.
    """
    import torch
    from huggingface_hub import snapshot_download
    from safetensors.torch import load_file
    from chatterbox.models.s3gen import S3Gen
    from chatterbox.models.t3 import T3
    from chatterbox.models.t3.modules.t3_config import T3Config
    from chatterbox.models.tokenizers import MTLTokenizer
    from chatterbox.models.voice_encoder import VoiceEncoder
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS, Conditionals

    regional = {
        "latam": ("ResembleAI/Chatterbox-Multilingual-es-mx-latam", "t3_es_mx_latam.safetensors"),
        "pt-br": ("ResembleAI/Chatterbox-Multilingual-pt-br", "t3_pt_br.safetensors"),
    }.get(kind)
    filename = regional[1] if regional else ("t3_mtl23ls_v2.safetensors" if kind == "multilingual-v2" else "t3_mtl23ls_v3.safetensors")
    if audio_decoder is not None and audio_decoder not in ("general", "v3"):
        raise ValueError("Audio decoder must be general or v3")
    use_v3 = audio_decoder == "v3" or (kind == "pt-br" and audio_decoder is None)
    regional_decoder = bool(regional) and use_v3
    patterns = ["ve.pt", "conds.pt"]
    if regional and not regional_decoder:
        patterns.append("s3gen.pt")
    if not regional:
        patterns += [filename, "s3gen.pt", "grapheme_mtl_merged_expanded_v1.json", "Cangjie5_TC.json"]
        if use_v3:
            patterns.append("s3gen_v3.pt")
    base = Path(snapshot_download(repo_id="ResembleAI/chatterbox", allow_patterns=patterns, token=os.getenv("HF_TOKEN")))
    assets = Path(snapshot_download(
        repo_id=regional[0],
        allow_patterns=[filename, "grapheme_mtl_merged_expanded_v1.json"] + (["s3gen_v3.pt"] if regional_decoder else []),
        token=os.getenv("HF_TOKEN"),
    )) if regional else base
    checkpoint = str(assets / filename)
    location = torch.device("cpu") if device in ("cpu", "mps") else None
    voice_encoder = VoiceEncoder()
    voice_encoder.load_state_dict(torch.load(base / "ve.pt", map_location=location, weights_only=True))
    voice_encoder.to(device).eval()
    t3 = T3(T3Config.multilingual())
    state = load_file(checkpoint)
    if "model" in state:
        state = state["model"][0]
    t3.load_state_dict(state)
    del state
    t3.to(device).eval()
    s3gen = S3Gen()
    decoder_path = assets / "s3gen_v3.pt" if regional_decoder else base / ("s3gen_v3.pt" if use_v3 else "s3gen.pt")
    load_decoder_state(s3gen, torch.load(decoder_path, map_location=location, weights_only=True), use_v3)
    s3gen.to(device).eval()
    tokenizer = MTLTokenizer(str(assets / "grapheme_mtl_merged_expanded_v1.json"))
    conds = Conditionals.load(base / "conds.pt", map_location=location).to(device) if (base / "conds.pt").exists() else None
    return ChatterboxMultilingualTTS(t3, s3gen, voice_encoder, tokenizer, device, conds=conds)


def load_model(kind: str, device: str, audio_decoder: str | None = None):
    import torch
    if kind not in ("multilingual", "multilingual-v3", "multilingual-v2", "latam", "pt-br", "chatterbox"):
        raise ValueError(f"Unknown narration model: {kind}")
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    if kind == "chatterbox":
        from chatterbox.tts import ChatterboxTTS
        model = ChatterboxTTS.from_pretrained(device=device)
        if audio_decoder is not None:
            from huggingface_hub import hf_hub_download
            from chatterbox.models.s3gen import S3Gen
            if audio_decoder not in ("general", "v3"):
                raise ValueError("Audio decoder must be general or v3")
            filename = "s3gen_v3.pt" if audio_decoder == "v3" else "s3gen.pt"
            checkpoint = hf_hub_download(repo_id="ResembleAI/chatterbox", filename=filename, token=os.getenv("HF_TOKEN"))
            del model.s3gen
            decoder = S3Gen()
            load_decoder_state(decoder, torch.load(checkpoint, map_location="cpu", weights_only=True), audio_decoder == "v3")
            model.s3gen = decoder.to(device).eval()
        return model
    return load_checkpoint_model(kind, device, audio_decoder) if audio_decoder is not None else load_checkpoint_model(kind, device)


def convert_audio(source: Path, target: Path, codec: str) -> None:
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-i", str(source),
        "-map", "0:a:0", "-vn", "-c:a", codec, "-threads", "1", "-ar", "48000", str(target),
    ], check=True)


def concatenate_audio(sources: list[Path], target: Path) -> None:
    listing = target.with_suffix(".concat.txt")
    listing.write_text("".join(f"file '{source.name}'\n" for source in sources))
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-n",
        "-f", "concat", "-safe", "1", "-i", str(listing),
        "-map", "0:a:0", "-vn", "-c:a", "pcm_s24le", "-threads", "1", "-ar", "48000", str(target),
    ], check=True)


def validate_generation(args: argparse.Namespace, scripts: dict[str, str]) -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg must be available on PATH")
    if args.voice_prompt and not args.voice_prompt.is_file():
        raise ValueError(f"Voice prompt does not exist: {args.voice_prompt}")
    if args.model == "chatterbox" and args.language != "en":
        raise ValueError("The original Chatterbox model only supports English")
    if args.model == "pt-br" and args.language != "pt":
        raise ValueError("The pt-br model only supports Portuguese")
    if args.model == "latam" and args.language != "es":
        raise ValueError("The latam model only supports Spanish; use multilingual for English or Portuguese")
    output_names = [f"{name}.{extension}" for name in scripts for extension in ("txt", "wav")]
    if not args.force and any((args.output_dir / name).exists() for name in output_names):
        raise FileExistsError("Audio or text files already exist; use --force to replace them")


def generate(args: argparse.Namespace, scripts: dict[str, str], voice_prompts: dict[str, Path]) -> None:
    validate_generation(args, scripts)
    output_names = [f"{name}.{extension}" for name in scripts for extension in ("txt", "wav")]
    print("Stage: Loading model", flush=True)
    import torchaudio
    decoder = getattr(args, "audio_decoder", None)
    model = load_model(args.model, args.device, decoder) if decoder is not None else load_model(args.model, args.device)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    staging_dir = getattr(args, "staging_dir", None)
    staging_context = nullcontext(staging_dir) if staging_dir else tempfile.TemporaryDirectory(prefix=".voice-", dir=args.output_dir)
    with staging_context as staging_name:
        staging = Path(staging_name)
        for track, script in scripts.items():
            print(f"Stage: Generating {track}", flush=True)
            voice_prompt = voice_prompt_for_track(track, voice_prompts, args.voice_prompt)
            kwargs = {
                "audio_prompt_path": str(voice_prompt) if voice_prompt else None,
                "exaggeration": args.exaggeration,
                "cfg_weight": args.cfg_weight,
                **{key: getattr(args, key) for key in ("temperature", "min_p", "top_p", "repetition_penalty") if getattr(args, key, None) is not None},
            }
            if args.model != "chatterbox":
                kwargs["language_id"] = args.language
            chunks = [script] if getattr(args, "single_utterance", False) else speech_chunks(script)
            native_chunks = []
            for index, chunk in enumerate(chunks):
                print(f"Stage: Generating {track} fragment {index + 1}/{len(chunks)}", flush=True)
                waveform = model.generate(text=chunk, **kwargs)
                # Never treat a capped output as a complete rendition of the transcript.
                if waveform.shape[-1] / model.sr >= 39.96:
                    raise RuntimeError("VOICE_TRUNCATED: a speech fragment reached the model's audio limit")
                native = staging / f"{track}-{index}-native.wav"
                torchaudio.save(str(native), waveform.cpu(), model.sr)
                native_chunks.append(native)
                del waveform
            print(f"Stage: Converting {track}", flush=True)
            if len(native_chunks) == 1:
                convert_audio(native_chunks[0], staging / f"{track}.wav", "pcm_s24le")
            else:
                concatenate_audio(native_chunks, staging / f"{track}.wav")
            (staging / f"{track}.txt").write_text(script + "\n", encoding="utf-8")
        for name in output_names:
            (staging / name).replace(args.output_dir / name)
        if args.force:
            for track in scripts:
                (args.output_dir / f"{track}.aiff").unlink(missing_ok=True)
    print(f"Tracks saved in {args.output_dir}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Synthesize audio tracks with Chatterbox from a scripts JSON file")
    parser.add_argument("--scripts", required=True, type=Path, help="JSON mapping track names to text")
    parser.add_argument("--single-utterance", action="store_true", help="Generate each track in one model request without splitting its text")
    parser.add_argument("--language", required=True, help="Language code supported by Chatterbox, such as es, en, or pt")
    parser.add_argument("--output-dir", required=True, type=Path, help="Output directory")
    parser.add_argument("--model", choices=("multilingual", "multilingual-v3", "multilingual-v2", "latam", "pt-br", "chatterbox"), default="multilingual")
    parser.add_argument("--audio-decoder", choices=("general", "v3"), help="Audio decoder: general s3gen.pt or s3gen_v3.pt; omitted retains the model default")
    parser.add_argument("--device", choices=("auto", "cpu", "mps", "cuda"), default="auto")
    parser.add_argument("--voice-prompt", type=Path, help="Optional WAV/MP3 voice reference")
    parser.add_argument("--voice-prompts", type=Path, help="JSON mapping track names to voice reference files")
    parser.add_argument("--exaggeration", type=float, default=0.5)
    parser.add_argument("--cfg-weight", type=float, default=0.5)
    parser.add_argument("--temperature", type=float)
    parser.add_argument("--min-p", type=float)
    parser.add_argument("--top-p", type=float)
    parser.add_argument("--repetition-penalty", type=float)
    parser.add_argument("--dry-run", action="store_true", help="Validate and show scripts without loading the model")
    parser.add_argument("--force", action="store_true", help="Replace existing tracks")
    parser.add_argument("--resource-profile", choices=("low", "standard"), default=os.getenv("VOICE_GENERATOR_PROFILE", "low"), help="low uses CPU and reduced process priority (default)")
    parser.add_argument("--threads", type=int, default=os.getenv("VOICE_GENERATOR_THREADS", "2"))
    parser.add_argument("--max-memory-mb", type=float, default=os.getenv("VOICE_GENERATOR_MAX_MEMORY_MB", "6144"), help="Maximum combined worker/child RSS in MiB")
    parser.add_argument("--min-free-memory-mb", type=float, default=os.getenv("VOICE_GENERATOR_MIN_FREE_MEMORY_MB", "1024"), help="Available system RAM reserve in MiB")
    parser.add_argument("--memory-grace-seconds", type=float, default=os.getenv("VOICE_GENERATOR_MEMORY_GRACE_SECONDS", "5"), help="Allowed continuous time below the RAM reserve")
    parser.add_argument("--timeout-seconds", type=float, default=os.getenv("VOICE_GENERATOR_TIMEOUT_SECONDS", "1800"))
    parser.add_argument("--lock-timeout-seconds", type=float, default=os.getenv("VOICE_GENERATOR_LOCK_TIMEOUT_SECONDS", "300"))
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--staging-dir", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        if not 0 <= args.exaggeration <= 2 or not 0 <= args.cfg_weight <= 1:
            raise ValueError("exaggeration must be between 0 and 2; cfg-weight between 0 and 1")
        for key, lower, upper in (("temperature", 0.05, 5), ("min_p", 0, 1), ("top_p", 0.01, 1), ("repetition_penalty", 1, 2)):
            value = getattr(args, key)
            if value is not None and not lower <= value <= upper:
                raise ValueError(f"{key} must be between {lower} and {upper}")
        scripts = read_scripts(args.scripts)
        voice_prompts = read_voice_prompts(args.voice_prompts, scripts)
        if args.dry_run:
            print(json.dumps({"language": args.language, "scripts": scripts, "voice_prompts": {track: str(sample) for track, sample in voice_prompts.items()}}, ensure_ascii=False, indent=2))
        else:
            from resources import Limits, configure_worker, generation_lock, supervise
            limits = Limits(args.resource_profile, args.threads, args.max_memory_mb, args.min_free_memory_mb, args.timeout_seconds, args.lock_timeout_seconds, args.memory_grace_seconds)
            limits.validate()
            if args.resource_profile == "low":
                if args.device not in ("auto", "cpu"):
                    raise ValueError("The low-consumption profile requires CPU; use --device cpu or --resource-profile standard")
                args.device = "cpu"
            if args.worker:
                configure_worker(limits, args.device)
                generate(args, scripts, voice_prompts)
            else:
                validate_generation(args, scripts)
                def interrupted(signum, frame):
                    raise KeyboardInterrupt
                previous_handler = signal.signal(signal.SIGTERM, interrupted)
                try:
                    with generation_lock(limits.lock_timeout_seconds) as lock_fd:
                        args.output_dir.mkdir(parents=True, exist_ok=True)
                        with tempfile.TemporaryDirectory(prefix=".voice-", dir=args.output_dir) as staging:
                            print(f"Resources: {limits.profile} profile, {args.device}, {limits.threads} threads, {limits.max_memory_mb:g} MiB RSS limit, {limits.min_free_memory_mb:g} MiB RAM reserve ({limits.memory_grace_seconds:g}s grace)", flush=True)
                            return supervise([sys.executable, str(Path(__file__).resolve()), *sys.argv[1:], "--worker", "--staging-dir", str(Path(staging).resolve())], limits, lock_fd)
                finally:
                    signal.signal(signal.SIGTERM, previous_handler)
        return 0
    except KeyboardInterrupt:
        print("Error: Voice generation interrupted by SIGTERM or SIGINT", file=sys.stderr)
        return 130
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
