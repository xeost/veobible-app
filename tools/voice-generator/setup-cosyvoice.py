#!/usr/bin/env python3
"""Install the pinned inference source and isolated environment; weights stay in HF cache."""
import argparse
import subprocess
import sys
from pathlib import Path
from cosyvoice_base import SOURCE_REVISION

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    source = root / ".cosyvoice-src"
    if not source.exists():
        subprocess.run(["git", "clone", "--no-checkout", "https://github.com/QwenAudio/CosyVoice.git", str(source)], check=True)
        subprocess.run(["git", "-C", str(source), "checkout", SOURCE_REVISION], check=True)
    revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    if revision != SOURCE_REVISION or subprocess.check_output(["git", "-C", str(source), "status", "--porcelain"], text=True).strip():
        raise SystemExit("CosyVoice source differs from the pinned clean revision; preserve it and use a fresh source checkout")
    subprocess.run(["git", "-C", str(source), "submodule", "update", "--init", "--recursive"], check=True)
    python = root / ".venv-cosyvoice/bin/python"
    if not python.exists():
        subprocess.run([sys.executable, "-m", "venv", str(python.parent.parent)], check=True)
    subprocess.run([str(python), "-m", "pip", "install", "--no-cache-dir", "-r", str(root / "requirements-cosyvoice.txt")], check=True)
    if args.download:
        subprocess.run([str(python), str(root / "download-cosyvoice.py")], check=True)
