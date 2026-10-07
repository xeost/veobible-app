# VeoBible Voice

Generic Python tool to synthesize voice tracks with Chatterbox. It receives a scripts JSON, a language, and an output directory. For each track, it produces `<name>.txt` and `<name>.wav`. The final audio files are 24-bit 48 kHz PCM WAVs.

## Installation

Requires Python 3.12, `ffmpeg` in `PATH`, and the packages in [requirements.txt](requirements.txt). Create the virtual environment inside `tools/voice-generator`:

```bash
cd tools/voice-generator
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

`shorts-daily-dose` uses this interpreter by default to generate local voices.

The initial model load may download weights from Hugging Face. Multilingual Chatterbox supports Spanish, English, and Portuguese, among other languages. The `latam` model uses the `ResembleAI/Chatterbox-Multilingual-es-mx-latam` checkpoint and only supports Spanish. If you use Hugging Face with authentication, export `HF_TOKEN`.

## Usage

Create a JSON mapping track names to texts, for example:

```json
{
  "welcome": "Welcome to my channel.",
  "farewell": "Until next time."
}
```

Then run:

```bash
.venv/bin/python cli.py --scripts /path/to/scripts.json --language en --output-dir /path/to/output --dry-run
.venv/bin/python cli.py --scripts /path/to/scripts.json --language en --output-dir /path/to/output
```

`--dry-run` validates and displays texts without loading the model or writing files. `--force` overwrites existing tracks. `--model latam` selects the Latin American model; default is `multilingual`. `--device` supports `auto`, `mps`, `cuda`, or `cpu`. `--voice-prompt` accepts a shared WAV/MP3 audio sample for all tracks. `--voice-prompts` accepts a JSON mapping track names to specific sample paths; each path takes precedence over the shared sample. `--exaggeration` and `--cfg-weight` control generation; both default to `0.5`.

Track names support lowercase letters, numbers, hyphens, and underscores, and must start with a letter. A single invocation generates all tracks with the model loaded only once. `shorts-daily-dose` uses this interface for its intros and outros, using its own [templates](../shorts-daily-dose/voice-templates.json).
