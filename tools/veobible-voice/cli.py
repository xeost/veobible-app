#!/usr/bin/env python3
"""Synthesize any named collection of text tracks with Chatterbox."""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# Numba's default cache can be unwritable when Chatterbox lives in another venv.
os.environ.setdefault("NUMBA_CACHE_DIR", str(Path(tempfile.gettempdir()) / "veobible-voice-numba"))


import re

TRACK_NAME = re.compile(r"^[a-z][a-z0-9_-]*$")


def read_scripts(scripts_path: Path) -> dict[str, str]:
    scripts = json.loads(scripts_path.read_text(encoding="utf-8"))
    if not isinstance(scripts, dict) or not scripts:
        raise ValueError("El archivo de guiones debe ser un objeto JSON no vacío")
    for name, script in scripts.items():
        if not isinstance(name, str) or not TRACK_NAME.fullmatch(name):
            raise ValueError(f"Nombre de pista inválido: {name}")
        if not isinstance(script, str) or not script.strip():
            raise ValueError(f"Texto vacío o inválido para la pista {name}")
    return {name: script.strip() for name, script in scripts.items()}


def load_latam_model(device: str):
    """Load the es-MX checkpoint using the same components as the local Chatterbox experiment."""
    import torch
    from huggingface_hub import hf_hub_download, snapshot_download
    from safetensors.torch import load_file
    from chatterbox.models.s3gen import S3Gen
    from chatterbox.models.t3 import T3
    from chatterbox.models.t3.modules.t3_config import T3Config
    from chatterbox.models.tokenizers import MTLTokenizer
    from chatterbox.models.voice_encoder import VoiceEncoder
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS, Conditionals

    base = Path(snapshot_download(
        repo_id="ResembleAI/chatterbox",
        allow_patterns=["ve.pt", "s3gen.pt", "conds.pt", "grapheme_mtl_merged_expanded_v1.json"],
        token=os.getenv("HF_TOKEN"),
    ))
    checkpoint = hf_hub_download(
        repo_id="ResembleAI/Chatterbox-Multilingual-es-mx-latam",
        filename="t3_es_mx_latam.safetensors",
        token=os.getenv("HF_TOKEN"),
    )
    location = torch.device("cpu") if device in ("cpu", "mps") else None
    voice_encoder = VoiceEncoder()
    voice_encoder.load_state_dict(torch.load(base / "ve.pt", map_location=location, weights_only=True))
    voice_encoder.to(device).eval()
    t3 = T3(T3Config.multilingual())
    state = load_file(checkpoint)
    if "model" in state:
        state = state["model"][0]
    t3.load_state_dict(state)
    t3.to(device).eval()
    s3gen = S3Gen()
    s3gen.load_state_dict(torch.load(base / "s3gen.pt", map_location=location, weights_only=True))
    s3gen.to(device).eval()
    tokenizer = MTLTokenizer(str(base / "grapheme_mtl_merged_expanded_v1.json"))
    conds = Conditionals.load(base / "conds.pt", map_location=location).to(device) if (base / "conds.pt").exists() else None
    return ChatterboxMultilingualTTS(t3, s3gen, voice_encoder, tokenizer, device, conds=conds)


def load_model(kind: str, device: str):
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    if kind == "latam":
        return load_latam_model(device)
    return ChatterboxMultilingualTTS.from_pretrained(device=device)


def convert_audio(source: Path, target: Path, codec: str) -> None:
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-i", str(source),
        "-map", "0:a:0", "-vn", "-c:a", codec, "-ar", "48000", str(target),
    ], check=True)


def generate(args: argparse.Namespace, scripts: dict[str, str]) -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg debe estar disponible en PATH")
    if args.voice_prompt and not args.voice_prompt.is_file():
        raise ValueError(f"No existe la muestra de voz: {args.voice_prompt}")
    if args.model == "latam" and args.language != "es":
        raise ValueError("El modelo latam solo admite español; usa multilingual para inglés o portugués")
    output_names = [f"{name}.{extension}" for name in scripts for extension in ("txt", "wav", "aiff")]
    if not args.force and any((args.output_dir / name).exists() for name in output_names):
        raise FileExistsError("Ya existen archivos de audio o texto; usa --force para reemplazarlos")

    import torchaudio
    model = load_model(args.model, args.device)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".voice-", dir=args.output_dir) as staging_name:
        staging = Path(staging_name)
        for track, script in scripts.items():
            print(f"Generando {track}: {script}", flush=True)
            kwargs = {
                "text": script,
                "language_id": args.language,
                "audio_prompt_path": str(args.voice_prompt) if args.voice_prompt else None,
                "exaggeration": args.exaggeration,
                "cfg_weight": args.cfg_weight,
            }
            waveform = model.generate(**kwargs)
            native = staging / f"{track}-native.wav"
            torchaudio.save(str(native), waveform.cpu(), model.sr)
            convert_audio(native, staging / f"{track}.wav", "pcm_s24le")
            convert_audio(staging / f"{track}.wav", staging / f"{track}.aiff", "pcm_s24be")
            (staging / f"{track}.txt").write_text(script + "\n", encoding="utf-8")
        for name in output_names:
            (staging / name).replace(args.output_dir / name)
    print(f"Pistas guardadas en {args.output_dir}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sintetiza pistas de audio con Chatterbox a partir de un JSON de guiones")
    parser.add_argument("--scripts", required=True, type=Path, help="JSON que asigna nombres de pista a textos")
    parser.add_argument("--language", required=True, help="Código de idioma admitido por Chatterbox, por ejemplo es, en o pt")
    parser.add_argument("--output-dir", required=True, type=Path, help="Directorio de salida")
    parser.add_argument("--model", choices=("multilingual", "latam"), default="multilingual")
    parser.add_argument("--device", choices=("auto", "cpu", "mps", "cuda"), default="auto")
    parser.add_argument("--voice-prompt", type=Path, help="WAV/MP3 de referencia de voz (opcional)")
    parser.add_argument("--exaggeration", type=float, default=0.5)
    parser.add_argument("--cfg-weight", type=float, default=0.5)
    parser.add_argument("--dry-run", action="store_true", help="Valida y muestra los guiones sin cargar el modelo")
    parser.add_argument("--force", action="store_true", help="Reemplaza pistas existentes")
    args = parser.parse_args()
    try:
        if not 0 <= args.exaggeration <= 1 or not 0 <= args.cfg_weight <= 1:
            raise ValueError("exaggeration y cfg-weight deben estar entre 0 y 1")
        scripts = read_scripts(args.scripts)
        if args.dry_run:
            print(json.dumps({"language": args.language, "scripts": scripts}, ensure_ascii=False, indent=2))
        else:
            generate(args, scripts)
        return 0
    except (FileNotFoundError, FileExistsError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
