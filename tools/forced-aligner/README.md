# Bible reading forced alignment

Local Python worker using `mlx-audio` and `mlx-community/Qwen3-ForcedAligner-0.6B-8bit` on Apple Silicon. Spanish (`es`), English (`en`) and Portuguese (`pt`) are supported. The video API supplies the actual chapter recording and the matching Bible text. No audio is uploaded.

## Install

Requires Apple Silicon macOS with Metal available, Python 3.12 and FFmpeg. From the repository root:

```sh
python3.12 -m venv tools/forced-aligner/.venv
tools/forced-aligner/.venv/bin/python -m pip install -r tools/forced-aligner/requirements.txt
```

The first real analysis downloads the aligner and `mlx-community/Qwen3-ASR-0.6B-8bit` into `tools/forced-aligner/.cache/huggingface` (ignored by Git). `HF_HOME` can override this directory. Later analyses reuse the downloads. Run the video API as a native macOS process with access to Metal, rather than in a Linux container.

## Editor workflow

Open a short or long video project. The existing estimated analysis still runs on entry. Use **Analyze this reading with AI** in a reading block, or **Analyze all readings with AI** in the section toolbar. The editor saves current settings before queueing. AI jobs share the serial generation queue with narration and video jobs. Editing this project's cuts is temporarily disabled during analysis; other projects remain available.

Results are retained locally if you leave the editor. When the editor observes completion, it applies and saves the analyzed timings, then reloads the waveform. Explicit manual cuts and legacy manual offsets are preserved. Prior automatic cuts can be updated by subsequent analyses. Available source context is expanded when the new boundaries require it. Review the cuts and save any further manual adjustments before rendering.

Only one timing job per project/environment is allowed at a time. A selected reading block analyzes its full source chapter, then applies only the selected passage's verses. An all-readings job loads each model once and processes chapters sequentially. Source recordings and text must correspond to the same translation; omissions, repetitions and dramatic audio can still require manual correction.

Before alignment, the worker transcribes only the first 30 seconds of each chapter with Qwen3-ASR (retrying with 60 seconds if needed). It locates the Bible's opening words and keeps any preceding speech as a separate heading, including spoken chapter numbers and book titles in Spanish, English and Portuguese. The original Bible text remains authoritative; recognized verse text never replaces it. If the opening cannot be matched reliably, the job fails and preserves existing cuts. Headings are included in alignment context but excluded from verse results. Original source coordinates are retained. The recognizer is released before loading the aligner to keep the two models out of memory at the same time.

## Worker contract

```sh
tools/forced-aligner/.venv/bin/python tools/forced-aligner/cli.py \
  --request /path/to/request.json --output /path/to/result.json
```

Request:

```json
{
  "language": "en",
  "chapters": [{
    "index": 0,
    "audio": "/absolute/chapter.mp3",
    "duration": 10.0,
    "segments": [{"id": "Psalms 117:1", "text": "O praise the Lord", "start": 0.0, "end": 10.0}]
  }]
}
```

`segments` must contain the full ordered chapter transcript with estimated source times. Identifiers are opaque to the worker. Output contains `model` and `chapters`, each with its `index` and `segments: [{id, words: [{id, text, start, end}]}]`. Word times are seconds in the original source recording. The video API derives verse boundaries from first/last word times with small acoustic margins. Output is written atomically only after all chapters succeed. stdout contains JSON progress lines; diagnostics go to stderr. `--dry-run` validates input without importing MLX or downloading weights.

Chapters up to 240 seconds are aligned together. Longer chapters use approximately 100-second cores ending at verse boundaries, with overlapping text/audio context and an acoustic anchor carried into the next window. An invalid window gets one retry with up to 10 additional seconds of audio on each side, within the 240-second limit; validation is unchanged. The initial windows depend on estimated speech rate; this is not a guarantee of accurate segmentation for arbitrary recordings. Collapsed durations, inconsistent overlaps and core words pinned to chunk edges fail the job instead of replacing existing cuts. Long gaps inside a verse or many words with zero duration flag that verse for careful listening in the editor. Small words can legitimately have zero duration because timestamps are quantized. There is no calibrated confidence score.

MLX's allocation budget is 6 GiB and its reusable cache is limited to 256 MiB. This is not a hard limit on total process RAM. The API runs one queue job at a time and terminates the worker process group after 30 minutes by default, including download/loading time. It releases the model when the job finishes. Direct CLI invocations should be run sequentially as well.

## API configuration

Set in `tools/video-project-api/.env` when overriding defaults:

- `VIDEO_ALIGNER_PYTHON`: interpreter; defaults to this tool's `.venv/bin/python`.
- `VIDEO_ALIGNER_SCRIPT`: worker entry point; defaults to this tool's `cli.py`.
- `VIDEO_ALIGNER_MODEL`: model repository or local directory.
- `VIDEO_ALIGNER_ASR_MODEL`: opening transcription model repository or local directory; defaults to `mlx-community/Qwen3-ASR-0.6B-8bit` (also available as CLI `--asr-model`).
- `VIDEO_ALIGNER_TIMEOUT_SECONDS`: positive timeout, default `1800`.

FFmpeg is selected by the video's existing configuration. Failed analyses preserve saved timings and appear in queue history. After an API restart, completed results survive; interrupted jobs are marked failed when read and can be queued again. The queue's recent history itself remains in memory, as with generation jobs.

## Tests

```sh
python3.12 -m unittest discover -s tools/forced-aligner -v
pnpm --dir tools/video-project-api test
pnpm --dir apps/dashboard test
```

Python unit tests do not load/download the model. API integration tests use a deterministic process adapter, real FFmpeg input files, and the real queue and timing-coordinate pipeline. Real-model accuracy must additionally be checked against the intended recordings.
