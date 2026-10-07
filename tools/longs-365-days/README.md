# VeoBible · Longs 365 Days

Interactive CLI to generate horizontal episodes for **The Bible in 365 Days**. Uses the existing catalog `episodes.json`, featuring 365 episodes, and produces **1920×1080 (16:9)** videos. Retains the features of `shorts-daily-dose`: languages, versions, usage statuses, audio and text timings adjustments, volume control, Chatterbox/ElevenLabs voice synthesis, regeneration, and publishing files.

## Installation and Execution

```bash
cd tools/longs-365-days
pnpm install
cp .env.example .env
pnpm start
```

It can also be executed from the repository root with **`pnpm longs`**. The dependencies and configuration of this tool are independent of `shorts-daily-dose`; it does not require that tool to function. Chatterbox utilizes its dedicated environment in [voice-generator](../voice-generator/README.md).

Node.js, pnpm, FFmpeg/ffprobe, and mpv are required to listen to and adjust audio. On macOS:

```bash
brew install ffmpeg mpv
```

Remotion uses Chromium to render; during the first render it may download its browser. If already installed in `node_modules/.remotion`, it is reused. Design fonts are Georgia and Avenir, available on macOS; the browser fallback font is applied on other systems.

## Configuration and Materials

Copy or adapt `.env.example`. All tool-specific variables are prefixed with **`VEOBIBLE_LONGS_`**. The shorts `.env` is not loaded and its API keys are not automatically reused. The tool loads its own `.env` even when executed from the repository root; environment variables exported in the process take precedence.

The default working directory is `/Users/fabian/Documents/veobible-longs`:

```text
veobible-longs/
├── material/
│   ├── videos/
│   │   ├── 0-intro.mp4
│   │   ├── 0-outro.mp4
│   │   ├── bg-0.mp4
│   │   └── bg-1.mp4
│   └── voices/
│       ├── es.mp3
│       ├── en.mp3
│       └── pt.mp3
└── outputs/
    ├── status.json
    └── rv1909/
        ├── default-version-settings.json
        └── episode-001/
```

Use horizontal backgrounds to take advantage of framing. Output is always 16:9; clips with different aspect ratios are centered and cropped without deformation. The intro framerate is preserved. A `bg-[n].mp4` background is randomly chosen and prepared as a looping boomerang.

The source for biblical audio remains, by default, in `/Users/fabian/Documents/audiobibles/sources/audios`. Scripture texts are read from `apps/frontend/public/bible-data` within the repository. These paths can be configured via `VEOBIBLE_LONGS_AUDIO_DIR` and `VEOBIBLE_LONGS_BIBLE_DATA_DIR`.

Configure in `.env`:

- Working directories, outputs, backgrounds, and Bible data paths.
- Voice provider, models, interpreter, and Chatterbox samples.
- ElevenLabs API key, model, and voice for each language. Library voices require a paid plan to be used via API; see section 4 of `.env.example`.
- Social accounts via `social-accounts.json` or `VEOBIBLE_LONGS_SOCIAL_ACCOUNTS`.
- Facebook is configured using each language's `facebook` key and displayed in the outro alongside YouTube, X, Instagram, and TikTok. An empty string hides it; the key can be omitted in legacy files.
- Render concurrency via `VEOBIBLE_LONGS_RENDER_CONCURRENCY`.

Materials and outputs from `shorts-daily-dose` are never modified.

## Episode Catalog

`episodes.json` is the catalog source. It preserves its original structure:

```json
{
  "id": 33,
  "start": { "book": "exodus", "chapter": 39, "verse": 8 },
  "end": { "book": "leviticus", "chapter": 1, "verse": 17 }
}
```

Numeric IDs between 1 and 365 are converted to stable folders `episode-001`…`episode-365`. Menus display `Day 033` followed by the translated reference. Used episodes appear at the end. Status is tracked independently per language, version, and episode, even if its video folder has been deleted.

Episodes spanning across chapters and **across books** are supported. Books are traversed in the order of the chosen version index; this includes the tail of the initial book, all intermediate books, and the start of the final book. Verse references include the book name to avoid confusing identical chapter numbers across different books. Boundaries are validated against that version; an unavailable episode displays an error and does not produce an incomplete video.

With the current Bible data, all 365 episodes have valid boundaries in RV1909, KJV, and ARC. Episode 334 ends in Romans 16:27, but SPABLL and WEB only have chapter 16 up to verse 24; that episode is marked as unavailable in those two versions. The original catalog is preserved.

## Composition and Audio

The video consists of three stages: intro, reading, and outro. Remotion handles composition and animations; FFmpeg analyzes pauses, prepares the boomerang, cuts and concatenates chapters, applies volume with a limiter when boosted, and extracts the thumbnail.

The scripture reading begins and ends with one second of silence. Chapters are concatenated into a single audio timeline to preserve order and avoid overlapping; verses appear sequentially with their reference. The horizontal design maintains dark text over a light, animated gradient, and a two-column social outro.

The intro lasts for the duration of its voiceover plus one second. The outro adds one second before the voiceover and one second after. Transitions exist between stages, but there is no fade from black at the beginning or fade to black at the end. The first frame displays the full intro as a cover/poster frame, and the next frame begins its usual animation. The thumbnail is extracted after the entrance animations finish.

## Interactive Adjustments

Menus are numbered, with arrow navigation, cyclic cursor wrapping, and last-option memory. `Back` resets menu selection. Backspace redraws the menu at the top; when entering numbers or answering `(Y/n)`, it erases characters normally.

**Adjust audio and verse timings** loads existing JSON offsets or in-session adjustments. Changes are kept in memory; they are saved to JSON files when creating or reprocessing the video.

In **Play complete passage**, `Editing passage START` begins active:

- `S` / `F`: select start / end.
- `A` / `D`: add / subtract five seconds to the selected offset.
- `E`: set the current playback position to the selected boundary.
- `B`: jump back five seconds; `L`: listen to the last five seconds; `R`: replay.
- Space: pause / resume with a brief volume ramp.
- `Enter` or Backspace: return while keeping adjustments in memory.
- `Esc`: return discarding changes from that playback session, preserving prior adjustments.

In **Play selected verse with context**, `A`, `D`, and `E` adjust the verse end boundary, and `N` advances to the next verse. Shifting a boundary also moves the shared boundary with the neighboring verse. `Esc` discards all adjustments made during that playback session, including verses selected with `N`; `Enter` and Backspace preserve them. The interface displays progress and verse texts; full playback includes neighboring verses as context.

**Adjust reading volume** accepts decimals from `0` to `4`: `0` mutes, `1` preserves original amplitude, `0.5` cuts in half, and `2` doubles volume. The initial value is retrieved from the active session, the episode, or `default-version-settings.json`, in that order.

**Listen to or generate intro/outro audio** is available before and after the initial render. The submenu offers **Generate** if the audio track does not exist yet, or **Regenerate** if it already exists, as well as preview playback with its text. WAV and TXT files are saved in `_internal/` without rendering the full video. Generating audio does not turn **Create complete video** into **Reprocess complete video**.

When creating or reprocessing the video, reusing existing voice audio is prompted with **Yes** as the default. If only one voiceover track has been generated, it is preserved and only the missing track is generated. Existing JSON settings are also preserved when creating the initial video. Generation uses `voice-generator` or ElevenLabs depending on `.env`.

## Output Files

```text
outputs/<version>/episode-001/
├── _internal/
│   ├── README.md
│   ├── 0-metadata.txt
│   ├── 1-intro.wav
│   ├── 1-intro.txt
│   ├── 2-passage-audio-offsets.json
│   ├── 2-passage-audio-settings.json
│   ├── 2-verse-text-offsets.json
│   ├── 2-versiculos.txt
│   ├── 3-outro.wav
│   └── 3-outro.txt
├── episode.mp4
├── thumbnail.jpg
├── youtube.txt
├── instagram.txt
├── tiktok.txt
└── x.txt
```

Passage adjustment file names are maintained to ensure consistency with the editing workflow. `_internal/README.md` explains their values and effects. In `video` mode, WAV/TXT voiceover tracks are not generated. Social descriptions are created in the chosen language; `x.txt` includes all verses of the episode and may exceed platform character limits for a single post.

## Verification

```bash
pnpm check
pnpm build
pnpm test
```

Tests cover the catalog, cross-book episodes, settings, statuses, voice providers, and a horizontal render test using synthetic media. Test renders require Chromium and permissions to open a local server. `pnpm benchmark` tests concurrency performance using fragments of configured backgrounds without touching published outputs.
