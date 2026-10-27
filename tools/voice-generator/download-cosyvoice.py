#!/usr/bin/env python3
"""Download Base and RL once in the shared Hugging Face cache, without inference."""
from pathlib import Path
from huggingface_hub import snapshot_download
from cosyvoice_base import REPOSITORY, COMMON_FILES, CHECKPOINTS

if __name__ == "__main__":
    snapshot = snapshot_download(repo_id=REPOSITORY, allow_patterns=[*COMMON_FILES, *CHECKPOINTS.values(), "CosyVoice-BlankEN/model.safetensors"], max_workers=2)
    print(f"Ready: {REPOSITORY} revision {Path(snapshot).name}")
