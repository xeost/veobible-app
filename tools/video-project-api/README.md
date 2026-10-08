# VeoBible Video Project API

Self-contained local Node service with Bible passage analysis, voice synthesis, and proprietary Remotion compositions in `src/engines/short` and `src/engines/long`. It does not import code, dependencies, catalogs, outputs, or configuration from the CLIs or dashboard. It uses static Bible data from the frontend without importing frontend code. Its HTTP contract is defined in `src/protocol.ts`.

## Installation and Assets

Requires Node 22+, pnpm, and FFmpeg/ffprobe. Install only this package and copy `.env.example` to `.env`. Start with `pnpm start` from this folder, or via `pnpm start:api-proxy` from the repository root. The proxy passes the shared token; process environment variables take precedence over this API's own `.env`.

- `apps/frontend/public/bible-data/<locale>/<version>/index.json` and `<book>/<chapter>.json`: static Bible data shared with the public site. This path is fixed, relative to the repository, and independent of the working directory; it is not configurable.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/bible-audio/<version>/`: original chapter audio files; alternative `VIDEO_AUDIO_DIR`. Existing naming convention `NN-book-chapter.mp3` or `.m4a` is preserved.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/videos/`: `0-intro.mp4`, `0-outro.mp4`, and background clips `bg-N.mp4`.
- `<SHORTS_WORKING_DIR|LONGS_WORKING_DIR>/material/voices/`: voice samples for Chatterbox (`es.mp3`, `en.mp3`, `pt.mp3`, with intro/outro variants).
- Narration scripts are configured per format and language in the Settings modals of Short Videos and Long Videos. They are stored in `site_settings` and received in `voiceTemplates` when analyzing, generating voices, or rendering; no local templates are read. Social accounts are configured in dashboard Settings, stored in `site_settings`, and received in `socialAccounts` on each render request. No accounts are read from local files; if no accounts are provided, social links are omitted from the outro.

`SHORTS_WORKING_DIR` and `LONGS_WORKING_DIR` define the root directories per format (absolute paths or relative to the package). On this machine they point to `/Users/fabian/Documents/veobible-shorts` and `/Users/fabian/Documents/veobible-longs`. Each root contains `material/{videos,voices,bible-audio}`, `outputs/<version>/<passage>` for production and CLI tools, and `outputs-dev/<version>/<passage>` for the development dashboard, using the same structure as the CLIs: `short.mp4` or `episode.mp4`, `thumbnail.jpg`, publication texts, and `_internal/`. Bible audios can remain in an external library via `VIDEO_AUDIO_DIR` or per-format options. Without variables, `work/short` and `work/long` inside the package are used. The former variables `VIDEO_MEDIA_DIR` and `VIDEO_SHORT/LONG_WORKING_DIR` are no longer used.

`VIDEO_SHORT_*` and `VIDEO_LONG_*` allow configuring each engine separately: `VIDEOS_DIR`, `AUDIO_DIR`, `FFMPEG`, `RENDER_CONCURRENCY`, `TTS_PROVIDER`, `TTS_PYTHON`, `TTS_MODEL`, `TTS_MODEL_ES/EN/PT`, `TTS_DEVICE`, `TTS_VOICE_PROMPT`, `TTS_VOICE_PROMPT_ES/EN/PT`, and `TTS_VOICE_PROMPT_<locale>_INTRO/OUTRO`. Social accounts come from dashboard Settings. `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL`, and `ELEVENLABS_VOICE_ES/EN/PT` are also supported per engine.

Local Chatterbox generation inherits the `VOICE_GENERATOR_*` resource settings documented in [voice-generator](../voice-generator/README.md#resource-supervision). The default low-consumption profile uses CPU, two threads, reduced priority, a 6 GiB RSS threshold, a 3 GiB available-RAM reserve, and a 30-minute timeout. A shared process lock also prevents concurrent model loads from the standalone CLI tools. Resource/time failures appear as failed queue items with a readable explanation in the editor; they do not stop the API server. Restart the API after changing its `.env`. These settings do not affect ElevenLabs or video rendering.

For local models, the only shared service is `voice-generator`: by default it uses `../voice-generator/cli.py` and its `.venv/bin/python`. `VIDEO_TTS_SCRIPT` and the `TTS_PYTHON` variables allow using a different installation. The CLIs are not involved in this call.

The dashboard tracks the file environment per project and passes `outputEnvironment` when generating, querying voices, and playing files. New projects follow their `NODE_ENV`; imported projects follow the environment of the dashboard that requests synchronization. The API supports `production` (default) and `development` per request, allowing it to serve both environments with independent outputs. Materials are shared between both environments.

`GET /v1/projects/existing?kind=short|long&outputEnvironment=production|development` discovers projects in `outputs/<version>/<slug>` or `outputs-dev/<version>/<slug>` according to the requested environment of the respective working directory. It uses project presets and metadata to reconstruct passages, and reads `status.json` in the selected output directory to translate usage flags into publication status, isolated by language and version. Internal files provide offsets, volume, and audio options; legacy internal naming conventions are supported. It keeps both environments separate, imports no CLI code, and does not modify CLI files. It returns valid projects, skipped counts, and IDs with active tasks. Videos already present are recognized as generated even if they lack `render-result.json`.

## HTTP and Persistence

Routes authenticated with a 32+ character Bearer token:

- `GET /v1/video-project-proposals?kind=short|long&locale=es|en|pt&version=<code>`: reads proposals from `material/video-project-presets.json` in the respective working directory and appends titles using book names from the selected version.
- `GET /v1/bible-versions/books?locale=es|en|pt&version=<code>`: books, names, and chapter/verse bounds for the selected version to enable manual project creation.
- `GET /v1/bible-versions`: discovers versions by language and code in the shared `bible-data` directory; reads the name from metadata in each index on every query.
- `GET /health`: availability and active jobs.
- `POST /v1/analyze`: text, context, scripts, cuts, timing, and backgrounds.
- `POST /v1/jobs`: render with task ID, numeric project ID, passage, version, and settings. Authenticated callback is optional; the dashboard does not use it.
- `GET /v1/jobs/:id`: ephemeral progress of a render task.
- `GET /v1/queue`: voice and video tasks; the dashboard only shows active or pending ones.
- `GET /v1/projects/:id/state`: state derived from active queue and output saved in project files.
- `GET /v1/projects/:id/media/:asset?kind=short|long&version=rv1909&passage=<id>&outputEnvironment=production|development`: video, thumbnail, intro/outro; supports Range requests.

Optional callbacks can only target `DASHBOARD_ORIGINS`. The queue is serial and accepts up to 20 jobs. The dashboard preserves settings and usage flags in D1, without a jobs table or persisted state. The API stores temporary progress in RAM and writes `_internal/render-result.json` upon render completion. After restarting, results remain on disk, but pending renders are not resumed; they can be re-triggered from project settings.

Voices and their texts are kept in `_internal/1-intro.{wav,txt}` and `_internal/3-outro.{wav,txt}`, alongside `2-versiculos.txt`, `0-metadata.txt`, and `README.md`. Settings remain in the database: the dashboard neither needs nor creates `2-passage-audio-offsets.json`, `2-passage-audio-settings.json`, `2-verse-text-offsets.json`, or `default-version-settings.json`. Existing CLI files are preserved; their settings and states are not automatically imported to the dashboard. `status.json` belongs to the CLI record of used publications, not rendering. Auxiliary synthesis and render files are temporary.

Dashboard projects are created manually. CLI progress does not automatically synchronize with the dashboard database.

## Project Proposals

Each format has a list in `<WORKING_DIR>/material/video-project-presets.json`. Both files use the same structure, independent of language or Bible version:

```json
[
  {
    "id": 1,
    "slug": "john-3-14-19",
    "start": { "book": "john", "chapter": 3, "verse": 14 },
    "end": { "book": "john", "chapter": 3, "verse": 19 }
  }
]
```

`id` is the proposal index within the list and not a database project ID. In long formats, it preserves the original episode number. `slug` preserves the CLI textual identifier: the original passage in shorts and `episode-001`, `episode-002`, etc. in longs. Both endpoints always include book, chapter, and verse, allowing them to span different books.

The initial conversion preserves exactly the 100 passages from `tools/shorts-daily-dose/popular-verses.json` and the 365 episodes from `tools/longs-365-days/episodes.json` in their original order, including the 40 episodes that cross book boundaries. CLI source files are not modified. The generator re-reads the respective list on each request. Short Videos and Long Videos menus in the dashboard synchronize these proposals per Bible version, inserting only missing slugs. Starting and ending books are preserved when converting the proposal to the render contract; longs include the episode number.

## Verification

`pnpm check` also verifies TSX compositions. `pnpm test` runs a test from an isolated copy of the API without CLI/dashboard peer folders, using synthetic assets and a test voice adapter.

`pnpm test:render` adds full renders of both formats and verifies that only MP4/JPG/WAV remain in project directories. Remotion requires local ports and downloads its browser to the API package if missing.

Generation queue responses include individual progress percentages and a batch summary. A batch starts when an idle queue receives work and includes tasks added before it drains. Total progress weights each task equally, retains finished tasks until the next batch, and counts failed tasks as settled. Video progress combines preparation stages with renderer progress; speech progress uses provider stages and local sampling percentages when available.

Authenticated `POST /v1/preview` prepares the same composition and media as final rendering without synthesizing voices or producing a final video. Both narrations must already exist. Its opaque media references are scoped to the project, format, version, passage and output environment, and are served through the existing authenticated media route. Temporary previews expire after 24 hours, with at most 20 retained per service process. The dashboard Player applies unsaved verse offsets and reading volume live. Verse trims may overlap neighboring verse timings while remaining inside the available audio and retaining positive duration.
