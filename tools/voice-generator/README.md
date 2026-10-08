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

## Resource supervision

The default `low` profile is intended for a MacBook Air M2 with 16 GB of shared RAM. It resolves `auto` to **CPU**, uses two computation threads, disables tokenizer parallelism, and lowers the worker's scheduling priority by 10. CPU generation is slower than MPS generation. Explicit GPU devices require `--resource-profile standard`; the standard profile still uses the memory/time supervisor and the shared lock.

The lightweight parent supervises the model in a separate process, checking combined worker/child RSS and available system RAM every **0.5 seconds**. These are watchdog thresholds, not OS-enforced hard memory limits: brief overshoots are possible. If monitoring is unavailable, generation stops rather than proceeding unsupervised. This reduces resource pressure but cannot guarantee protection against OS or hardware faults.

| CLI option | Environment variable | Default |
| --- | --- | --- |
| `--resource-profile` | `VOICE_GENERATOR_PROFILE` | `low` |
| `--threads` | `VOICE_GENERATOR_THREADS` | `2` |
| `--max-memory-mb` | `VOICE_GENERATOR_MAX_MEMORY_MB` | `6144` MiB (6 GiB combined RSS) |
| `--min-free-memory-mb` | `VOICE_GENERATOR_MIN_FREE_MEMORY_MB` | `3072` MiB (3 GiB available RAM) |
| `--timeout-seconds` | `VOICE_GENERATOR_TIMEOUT_SECONDS` | `1800` (30 minutes, including model loading) |
| `--lock-timeout-seconds` | `VOICE_GENERATOR_LOCK_TIMEOUT_SECONDS` | `300` (5 minutes waiting for another invocation) |

CLI options override environment variables. The same defaults apply when called by the dashboard, `shorts-daily-dose`, or `longs-365-days`. Set environment variables in the invoking tool's `.env` or shell to adjust them. In the standard profile, MPS additionally receives a Metal allocator budget of at most 4 GiB (or the RSS limit, if smaller); Metal allocations and RSS are different measures, so the system RAM check remains necessary.

Only one invocation per OS user may load Chatterbox at a time, across working directories and formats. A macOS/Linux advisory lock in `/tmp/veobible-voice-<uid>.lock` persists while the worker runs and is released automatically; the lock file itself is intentionally retained. Waiting does not load a model. After five minutes, a waiting invocation fails and can be retried.

On timeout, excess memory, or supervisor interruption, the entire worker process group is terminated, escalating to a forced stop after two seconds. The supervisor cleans its temporary audio directory; existing final tracks are preserved until all replacements have been generated. `VOICE_RESOURCE_LIMIT`, `VOICE_TIMEOUT`, and `VOICE_BUSY` diagnostics let callers identify the reason without exposing technical details in the dashboard. `--dry-run` does not launch workers or acquire locks.

Run the lightweight tests without synthesizing audio:

```bash
.venv/bin/python -m unittest discover -s . -v
```

Track names support lowercase letters, numbers, hyphens, and underscores, and must start with a letter. A single invocation generates all tracks with the model loaded only once. `shorts-daily-dose` uses this interface for its intros and outros, using its own [templates](../shorts-daily-dose/voice-templates.json).
