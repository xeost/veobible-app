# VeoBible Voice

Internal Python worker for dashboard narration synthesis with Chatterbox. Requests follow `dashboard → api-proxy → video-project-api → voice-generator`; the proxy routes requests and the video API manages the generation queue and launches this worker. It receives a scripts JSON, a language, and an output directory. For each track, it produces `<name>.txt` and `<name>.wav`. The final audio files are 24-bit 48 kHz PCM WAVs.

## Installation

Requires Python 3.12, `ffmpeg` in `PATH`, and the packages in [requirements.txt](requirements.txt). Create the virtual environment inside `tools/voice-generator`:

```bash
cd tools/voice-generator
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

`video-project-api` uses this interpreter by default to generate introduction and closing narrations requested from the dashboard. Configure narration templates in the dashboard's Short Videos and Long Videos settings.

The initial model load may download weights from Hugging Face. Multilingual Chatterbox **V3 is the default** and supports Spanish, English, and Portuguese, among other languages. The `latam` model uses the `ResembleAI/Chatterbox-Multilingual-es-mx-latam` checkpoint and only supports Spanish. If you use Hugging Face with authentication, export `HF_TOKEN`.

## Worker interface

The video API supplies these arguments automatically. The commands below are intended for development diagnostics.

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

`--dry-run` validates and displays texts without loading the model or writing files. `--force` overwrites existing tracks. `--model multilingual` (the default) and `--model multilingual-v3` explicitly load `t3_mtl23ls_v3.safetensors`. `--model multilingual-v2` retains the previous checkpoint as a manual fallback; errors never silently downgrade to V2. `--model latam` selects the Latin American model. The explicit checkpoint loader supports the installed `chatterbox-tts` 0.1.7 and reuses the upstream multilingual architecture, decoder, tokenizer and voice encoder; no library upgrade is needed. `--device` supports `auto`, `mps`, `cuda`, or `cpu`. `--voice-prompt` accepts a shared WAV/MP3 audio sample for all tracks. `--voice-prompts` accepts a JSON mapping track names to specific sample paths; each path takes precedence over the shared sample. `--exaggeration` (0–2) and `--cfg-weight` (0–1) control generation; both default to `0.5`. Optional `--temperature` (0.05–5), `--min-p` (0–1), `--top-p` (0.01–1), and `--repetition-penalty` (1–2) are forwarded to synthesis. When omitted, these optional parameters retain the installed model’s defaults. The dashboard sends all six explicitly for its narration presets.

## Resource supervision

The default `low` profile is intended for a MacBook Air M2 with 16 GB of shared RAM. It resolves `auto` to **CPU**, uses two computation threads, disables tokenizer parallelism, and lowers the worker's scheduling priority by 10. CPU generation is slower than MPS generation. Explicit GPU devices require `--resource-profile standard`; the standard profile still uses the memory/time supervisor and the shared lock.

The lightweight parent supervises the model in a separate process, checking combined worker/child RSS and available system RAM every **0.5 seconds**. These are watchdog thresholds, not OS-enforced hard memory limits: brief overshoots are possible. If monitoring is unavailable, generation stops rather than proceeding unsupervised. This reduces resource pressure but cannot guarantee protection against OS or hardware faults.

| CLI option | Environment variable | Default |
| --- | --- | --- |
| `--resource-profile` | `VOICE_GENERATOR_PROFILE` | `low` |
| `--threads` | `VOICE_GENERATOR_THREADS` | `2` |
| `--max-memory-mb` | `VOICE_GENERATOR_MAX_MEMORY_MB` | `6144` MiB (6 GiB combined RSS) |
| `--min-free-memory-mb` | `VOICE_GENERATOR_MIN_FREE_MEMORY_MB` | `1024` MiB (1 GiB available RAM) |
| `--memory-grace-seconds` | `VOICE_GENERATOR_MEMORY_GRACE_SECONDS` | `5` (continuous seconds below the RAM reserve) |
| `--timeout-seconds` | `VOICE_GENERATOR_TIMEOUT_SECONDS` | `1800` (30 minutes, including model loading) |
| `--lock-timeout-seconds` | `VOICE_GENERATOR_LOCK_TIMEOUT_SECONDS` | `300` (5 minutes waiting for another invocation) |

The available-RAM check tolerates dips below 1 GiB for up to five continuous seconds during generation; recovery resets the timer. Below 256 MiB, it stops immediately (or below one quarter of the configured reserve, when smaller). The RSS and time limits remain immediate. Before loading the model, at least the configured RAM reserve must be available. Failure diagnostics include measured RAM/RSS and the threshold to help tune settings.

Command-line options override environment variables. Dashboard generations inherit these variables from `video-project-api`; configure them in that API's `.env` or its process environment. In the standard profile, MPS additionally receives a Metal allocator budget of at most 4 GiB (or the RSS limit, if smaller); Metal allocations and RSS are different measures, so the system RAM check remains necessary.

Only one invocation per OS user may load Chatterbox at a time, across working directories and formats. A macOS/Linux advisory lock in `/tmp/veobible-voice-<uid>.lock` persists while the worker runs and is released automatically; the lock file itself is intentionally retained. Waiting does not load a model. After five minutes, a waiting invocation fails and can be retried.

On timeout, excess memory, or supervisor interruption, the entire worker process group is terminated, escalating to a forced stop after two seconds. The supervisor cleans its temporary audio directory; existing final tracks are preserved until all replacements have been generated. `VOICE_RESOURCE_LIMIT`, `VOICE_TIMEOUT`, and `VOICE_BUSY` diagnostics let callers identify the reason without exposing technical details in the dashboard. `--dry-run` does not launch workers or acquire locks.

Run the lightweight tests without synthesizing audio:

```bash
.venv/bin/python -m unittest discover -s . -v
```

Track names support lowercase letters, numbers, hyphens, and underscores, and must start with a letter. A single invocation generates all tracks with the model loaded only once. Narration templates are stored in dashboard settings and passed by `video-project-api`; this worker does not read local template files.

Long texts are synthesized in fragments bounded to 220 characters and 35 words, respecting verse lines and sentence/clause boundaries where possible. Every fragment uses the same voice reference and generation parameters; lossless concatenation produces one 48 kHz WAV and retains the full original script. This avoids the installed model's 1,000 speech-token limit (40 seconds per synthesis call), which can truncate slower readings before the last words. Any fragment still reaching that limit fails explicitly without replacing existing audio. Timing analysis runs on the final combined recording, so saved verse cuts refer to the playable file.

## Model selection by language

The dashboard's Admin tools → Local AI Models settings select the model independently for English, Spanish and Portuguese, shared by both video formats. The worker accepts `--model chatterbox` for original English-only Chatterbox, `--model pt-br` for Brazilian Portuguese and `--model latam` for Latin American Spanish. General multilingual choices use `multilingual-v3` with the appropriate language ID and existing language-specific voice samples.

Original Chatterbox uses its English loader and does not receive `language_id`. Regional language packs load their own T3 weights and tokenizer, with shared voice-encoder/reference components. Latin American Spanish uses `s3gen.pt` from `ResembleAI/chatterbox`, matching Avance Motor. Brazilian Portuguese retains its regional `s3gen_v3.pt` decoder. Regional decoder loading permits only the two deterministic S3Tokenizer spectrogram buffers omitted by the official checkpoints (`tokenizer._mel_filters`, `tokenizer.window`); all learned weights and unexpected keys are still checked. Resource supervision and atomic WAV output remain unchanged. Missing assets may download on first use; choosing or saving a setting does not itself load a model or synthesize speech.

Passage-reading requests use `--single-utterance`: each named track contains exactly one complete verse and is sent to the model once, without sentence or clause splitting. Other narrations retain bounded fragmentation. The existing audio-limit check still rejects truncated outputs instead of publishing incomplete recordings.

### Audio decoder selection

Admin tools offers an Audio decoder selector under Advanced voice settings after the sampling parameters, for every language and model. Choices are saved separately for each language/model pair in `voice_generation_models.decoders`. `general` selects `s3gen.pt` from `ResembleAI/chatterbox`; `v3` selects `s3gen_v3.pt` (regional assets for Latam/pt-BR, general assets otherwise). Original English Chatterbox also accepts either decoder. Defaults preserve General for Latam and multilingual models, and V3 for pt-BR. CLI callers omitting `--audio-decoder` retain their existing model defaults.

Requests carry `voiceDecoder` through voice examples, video narration and audio projects. Example and recording metadata include the selected decoder; chapter announcement cache identities and signed media queries include it, isolating the two versions. Existing project recordings change only on regeneration.
