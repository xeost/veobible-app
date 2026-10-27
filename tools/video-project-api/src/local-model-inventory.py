"""Read local revisions and package metadata without loading models or downloading files."""
import sys
sys.dont_write_bytecode = True
import importlib.metadata
import json
import os
from pathlib import Path
import re

SHA = re.compile(r"(?:[a-f0-9]{40}|[a-f0-9]{64})\Z")


def inspect_model(model, cache):
    if model.get("localPath"):
        return {"status": "local" if Path(model["localPath"]).is_dir() else "not_downloaded", "revision": None}
    folder = cache / ("models--" + model["repository"].replace("/", "--"))
    reference = folder / "refs" / "main"
    if not reference.is_file():
        # Without the main ref, selecting the newest snapshot could misidentify
        # a cached PR or an unrelated branch as the model used by the worker.
        return {"status": "not_downloaded", "revision": None}
    revision = reference.read_text().strip()
    if not SHA.fullmatch(revision):
        return {"status": "unavailable", "revision": None}
    snapshot = folder / "snapshots" / revision
    required = model["required"]
    complete = snapshot.is_dir() and all(
        any(file.is_file() for file in snapshot.glob(pattern)) for pattern in required
    )
    return {"status": "downloaded" if complete else "incomplete", "revision": revision}


def shared_cache():
    # Use the installed library's cache precedence when available. Importing its
    # constants does not load inference libraries or query the model host.
    try:
        from huggingface_hub.constants import HF_HUB_CACHE
        cache = Path(HF_HUB_CACHE)
    except ImportError:
        home = os.environ.get("HF_HOME") or str(Path(os.environ.get("XDG_CACHE_HOME", str(Path.home() / ".cache"))) / "huggingface")
        cache = Path(os.environ.get("HF_HUB_CACHE") or os.environ.get("HUGGINGFACE_HUB_CACHE") or str(Path(home) / "hub"))
    return cache


def inspect(request):
    cache = shared_cache()
    try:
        version = importlib.metadata.version(request["package"])
    except importlib.metadata.PackageNotFoundError:
        version = None
    if request["package"] == "cosyvoice":
        import subprocess
        source = Path(os.environ.get("VIDEO_COSYVOICE_SOURCE", str(Path(__file__).resolve().parents[2] / "voice-generator/.cosyvoice-src")))
        try:
            revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True, timeout=2).strip()
            for package in ("torch", "onnxruntime", "transformers", "HyperPyYAML"):
                importlib.metadata.version(package)
            version = "git+" + revision[:12] if SHA.fullmatch(revision) else None
        except (OSError, subprocess.SubprocessError, importlib.metadata.PackageNotFoundError):
            version = None
    results = []
    for model in request["models"]:
        try:
            results.append(inspect_model(model, cache))
        except (OSError, ValueError):
            results.append({"status": "unavailable", "revision": None})
    return {"version": version, "models": results}



if __name__ == "__main__":
    print(json.dumps(inspect(json.loads(sys.argv[1]))))
