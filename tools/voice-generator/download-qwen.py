#!/usr/bin/env python3
"""Download both supported official Base snapshots without loading inference models."""
from pathlib import Path

from huggingface_hub import snapshot_download
from qwen_base import QWEN_MODELS

for repository in QWEN_MODELS.values():
    print(f'Downloading {repository}', flush=True)
    snapshot = snapshot_download(repo_id=repository, ignore_patterns=['*.md', '.gitattributes'], max_workers=2)
    print(f'Ready: {repository} revision {Path(snapshot).name}', flush=True)
