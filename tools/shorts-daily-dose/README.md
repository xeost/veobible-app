# VeoBible Shorts CLI

Interactive wizard to create complete videos of popular Bible passages. Select language, version, and passage. Each preparation creates the video, a thumbnail, and ready-to-publish descriptions; working files remain inside `_internal/`. You can mark the passage as used after generating it.

## Local Files in Remotion

The Remotion renderer automatically prepares intro, background, and outro videos, Bible audio, and voiceovers in a temporary public folder inside its bundle. The composition uses `staticFile()` to obtain URLs that the browser can load, instead of receiving absolute disk paths (`/Users/...`). You do not need to move your files or change their paths in `.env`.

Each render uses independent names, reuses a single copy per source audio file, and removes its temporary media upon completion or failure. Original files are preserved. This prevents HTTP 404 errors when loading local videos or audios, including consecutive renders during the same session. See the [Remotion documentation on absolute paths](https://www.remotion.dev/docs/miscellaneous/absolute-paths).

The video starts and ends without fading to black. Its first frame shows all intro elements in their final position; starting from the second frame, they are hidden and the usual entrance animation plays. Only the intro layers reset their animation: audio and background maintain their original timing. `thumbnail.jpg` is still captured after the normal entrance. The first frame serves as the cover if the platform uses it; each social network can select a different preview image.

## Rendering Performance and Smoothness

All three stages use `Video` from `@remotion/media`, which decodes the frame corresponding to the timeline. The composition preserves the FPS of `0-intro.mp4` (including fractional values like `30000/1001`); the boomerang loop is generated at that same rate. If source clips have different frame rates, they are adapted to the composition rate without altering their speed. No frames are fabricated through interpolation.

The actual duration of each intro/outro video is handled separately from its narration duration. If the video ends earlier, its last frame is held while animations and audio continue. If it is longer, it is trimmed when the stage completes.

Rendering uses intermediate JPEG frames and, by default, half of available CPUs with a maximum of four processes. You can configure `VEOBIBLE_SHORTS_RENDER_CONCURRENCY` in `.env`: it accepts integers between `1` and the number of available CPUs. Increasing it may degrade performance or increase memory consumption.

Run `pnpm benchmark` from this tool to compare 1, 2, and 4 processes. It uses two-second samples of your real videos, at their original resolution, with synthetic audio; it warms up the bundle before measuring and deletes all temporary files. It does not modify your backgrounds, narrations, or published files. Timings include preparation and encoding; longer passages may favor different concurrency settings. Remotion composes via a browser and does not guarantee matching native FFmpeg composition speeds. See the [official performance recommendations](https://www.remotion.dev/docs/performance).

## Installation and Execution

Requires Node.js 18+, pnpm, `ffmpeg`, and `ffprobe` (included with FFmpeg) available in `PATH`. The intro title is drawn using the `drawtext` filter: the FFmpeg build must include `libfreetype`, `libharfbuzz`, and `libfontconfig`.

On macOS, install [ffmpeg-full from Homebrew](https://formulae.brew.sh/formula/ffmpeg-full). It is a separate formula from `ffmpeg` and is not added to `PATH` automatically. The CLI detects its binary in standard Homebrew prefixes, so you do not need to replace your system FFmpeg:

```bash
brew install ffmpeg-full
"$(brew --prefix ffmpeg-full)/bin/ffmpeg" -hide_banner -filters | grep -E 'drawtext|drawbox|geq|xfade|acrossfade|silencedetect'
```

If you installed `ffmpeg-full` in another prefix, set `VEOBIBLE_SHORTS_FFMPEG` in `.env` with the full path to its binary; `ffprobe` will be searched for in the same directory. If you prefer to use it globally from the terminal, add `export PATH="$(brew --prefix ffmpeg-full)/bin:$PATH"` to your shell configuration (e.g., `~/.zshrc`). The CLI reports any missing filters before rendering.

Filters used by the composition:

| Function | Filters |
| --- | --- |
| Title and composition | `drawtext`, `drawbox`, `geq`, `vignette`, `color`, `fade`, `overlay`, `format`, `fps`, `scale`, `crop` |
| Boomerang and duration | `split`, `reverse`, `concat`, `trim`, `tpad`, `setpts`, `settb` |
| Audio and transitions | `atrim`, `asetpts`, `aresample`, `aformat`, `anull`, `adelay`, `apad`, `amix`, `volume`, `alimiter`, `acrossfade`, `xfade` |
| Cut adjustment | `silencedetect` |

```bash
cd tools/shorts-daily-dose
pnpm install
cp .env.example .env
pnpm start
```

It can also be started from the repository root with `pnpm shorts`.

Menus display a list of options with fixed order and numbering. Select using **↑/↓** or typing the number, and press **Enter** to choose. The cursor wraps around: ↑ from the first option selects the last, and ↓ from the last selects the first, maintaining the fixed list order. On long lists, the visible viewport scrolls to keep the banner on screen. Whenever a menu opens, it appears at the top of the terminal with the VeoBible banner above it. Press **Backspace** to redraw the current menu from the top. Previous output remains accessible by scrolling through terminal history.

## Configuration

Copy `.env.example` to `.env` inside `tools/shorts-daily-dose` and adjust paths. The tool loads that file even if run from the repository root. You can also adjust defaults in `src/config.ts`. Environment variables exported in the process take priority over `.env`; if a variable is missing, the default from `config.ts` is used.

| Variable | Default |
| --- | --- |
| `VEOBIBLE_SHORTS_WORKING_DIR` | `/Users/fabian/Documents/veobible-shorts` |
| `VEOBIBLE_SHORTS_OUTPUT_DIR` | `<workingDir>/outputs` |
| `VEOBIBLE_SHORTS_VIDEOS_DIR` | `<workingDir>/material/videos` |
| `VEOBIBLE_SHORTS_FFMPEG` | Homebrew `ffmpeg-full` on macOS if installed; otherwise `ffmpeg` from `PATH` |
| `VEOBIBLE_SHORTS_CLIP_AUDIO_MODE` | `voice`; also accepts `mix` and `video` |
| `VEOBIBLE_SHORTS_AUDIO_DIR` | `/Users/fabian/Documents/audiobibles/sources/audios` |
| `VEOBIBLE_SHORTS_BIBLE_DATA_DIR` | `<repository root>/apps/frontend/public/bible-data` |
| `VEOBIBLE_SHORTS_TTS_PROVIDER` | `chatterbox`; also accepts `elevenlabs` |
| `VEOBIBLE_SHORTS_ELEVENLABS_API_KEY` | Empty; required for ElevenLabs |
| `VEOBIBLE_SHORTS_ELEVENLABS_MODEL` | `eleven_multilingual_v2` |
| `VEOBIBLE_SHORTS_ELEVENLABS_VOICE_ES`, `_EN`, `_PT` | Empty; required voice ID for the selected language with ElevenLabs |
| `VEOBIBLE_SHORTS_TTS_PYTHON` | `<repository root>/tools/voice-generator/.venv/bin/python` |
| `VEOBIBLE_SHORTS_TTS_MODEL` | `multilingual` (`latam` only for Spanish) |
| `VEOBIBLE_SHORTS_TTS_MODEL_ES`, `_EN`, `_PT` | Language model; if omitted, uses `VEOBIBLE_SHORTS_TTS_MODEL` |
| `VEOBIBLE_SHORTS_TTS_DEVICE` | `auto` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES` | `<workingDir>/material/voices/es.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN` | `<workingDir>/material/voices/en.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT` | `<workingDir>/material/voices/pt.mp3` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES_INTRO`, `_ES_OUTRO` (and equivalent `_EN_*`, `_PT_*`) | Optional paths per track; if missing, searches `<workingDir>/material/voices/<language>-<track>.mp3` or `.wav` |
| `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT` | Empty; shared sample replacing defaults when no language path exists |
| `VEOBIBLE_SHORTS_TTS_TEMPLATES` | `tools/shorts-daily-dose/voice-templates.json` |

`VEOBIBLE_SHORTS_OUTPUT_DIR` is optional: if omitted, `outputs` inside `VEOBIBLE_SHORTS_WORKING_DIR` is used. The `.env` file is excluded from Git; `.env.example` serves as a template.

The catalog shared across all languages is in `popular-verses.json`. Each entry requires a unique `id`, the `book` in English matching Bible index names, and `start` and `end` endpoints with `chapter` and `verse`. Passages can span chapters within the same book. The tool validates boundaries against the chosen version.

When defining a passage, aim for selected verse texts to contain **between 130 and 150 words**. This length targets a narration duration of approximately **60 seconds** for the short video. Word counts vary across languages and versions, so verify this in each version you use.

The included catalog contains **100 passages across all 66 books**, all verified with **130–150 words in Reina Valera 1909**. See [the selection and counts per version](popular-verses.md) for passage themes, selection criteria, and consulted sources. The ordering is an editorial recommendation for shorts. Durations of 60–70 seconds depend on narration pace and pauses; confirm against the final audio.

Files are saved under `<outputDir>/<versionId>/<id>/`. `status.json` is stored directly in `<outputDir>` and tracks each passage by **language, version, and passage**, with keys like `es/rv1909/john-3-14-19`. Marking a passage in one version does not mark it in other versions or languages. In the list, used passages for the selected version and language appear at the bottom with a **✓ Used** mark. Creating the video does not mark it automatically; the wizard prompts at the end. If skipped, the passage can be marked later from its menu.

Legacy format records are interpreted using the language and version stored in their `locale` and `version` fields. When marking another passage, the file is saved with the new keys, preserving existing dates and paths. The CLI does not attribute legacy marks to different versions or languages.

## Interactive Audio and Text Timing Adjustment

In each passage menu, **Adjust audio and verse timings** appears before **Create complete video** or **Reprocess complete video**. It works even before generating the first video; it does not invoke Chatterbox or render video to preview adjustments.

All menus remember the last used option during the session, including those in the timing editor. Upon returning to a menu, that option is selected if still available: press **Enter** to repeat it or change selection with arrow keys or a number. Memory is independent per menu and context (language, version, and passage) and resets when exiting the CLI. Choosing **Back** also clears the remembered selection for that menu: upon returning, the first option is active, including timing editor menus. Marking a passage as used is another exception: selection for that version's passage list is forgotten so that, on return, the first item of the reordered list is active.

1. **Audio cut**: listen to the entire passage, its first five seconds, or its last five seconds. When listening to the beginning, the reference and text of the first verse remain visible; when listening to the end, those of the last verse remain visible. Enter decimal offsets via **Set start offset…** and **Set end offset…** to adjust the start and end. Repeat playback until the cut contains exactly the desired reading.
2. **Verse text**: choose a verse and listen to its audio with one second of context on each side, or play the entire passage with text displayed in the terminal. Adjust its entrance and exit. Moving a verse's end also moves the next verse's start; moving its start also moves the previous verse's end. The first and last verses have only one neighbor. The preview displays text intervals; entrance and exit animations are applied when rendering the video.

In **Play complete passage**, you can adjust the audio cut without returning to the menu:

- **S** selects start; **F** selects end (initial selection). The screen displays the active endpoint and both offsets.
- **A/D** adds/subtracts five seconds to/from the active endpoint offset. At the start, adding trims audio and subtracting includes prior audio; at the end, adding extends and subtracting trims.
- **E** sets the active endpoint to the current playback position and calculates its offset relative to the original estimate.
- **B** seeks back five seconds from the current point; **L** plays the last five seconds of the updated cut; **R** replays the cut from the start.

When adjusting the start, playback returns to the new start for verification. When adjusting the end, the fragment updates and can be checked with **L** or **R**. Source audio outside the original cut remains available, even in multi-chapter passages; exiting source bounds or leaving empty cuts is disallowed. **PASSAGE/CONTEXT** text displays and scrolling remain available. The interface remains open when audio completes, and changes are retained in memory upon returning to the menu; they are saved when rendering the video with those settings.

In **Play selected verse with context**, the interface shows fragment playback percentage, position within the passage, verse end time, and offset. It remains open when audio ends so you can continue adjustments:

- **A**: adds five seconds to the end offset, identical to **Set end offset…**. Expands playback to the new end plus one second of context within passage audio.
- **D**: subtracts five seconds from the end offset and adjusts the fragment to the new end plus one second of context. Changes producing invalid durations or bounds outside the passage are rejected.
- **B**: seeks back five seconds from the current point and replays from there, staying within the fragment.
- **L**: plays the last five seconds of the complete fragment, using its updated end (or the entire fragment if shorter than five seconds).
- **N**: selects the next verse and starts playing it with one second of context on each side, without leaving the interface. Uses updated bounds and offsets, preserves prior adjustments, and leaves that verse selected upon returning to the menu. On the last verse, it displays a notice and remains there.
- **E**: sets the verse end at the current point and calculates its offset relative to original estimate. It also updates the start of the next verse. The fragment adjusts to the new end plus one second of context; displayed text updates live according to corrected bounds, verifiable with **L** or **R**.
- **R**: replays the entire fragment; **Space** pauses/resumes; **Enter/Esc** returns to the menu.

The same validations as **Set end offset…** prevent overlaps, negative durations, or exiting the passage: rejected adjustments are flagged on screen. Changes stay in memory; choose **Use these timings — keep in memory** and create or reprocess the video to save them to JSON. Playback position is estimated via player clock, as in other previews; small differences may occur due to audio device latency.

1. **Use these timings — keep in memory**: returns to the passage menu and creates or reprocesses the video. Offsets are only saved to `_internal/` JSON files at that time.

In the video, 100% of the transition between verses occurs before the configured boundary, within the departing verse's duration. First the previous text gently exits, and then the next text smoothly enters, avoiding text overlap. All lines of the new verse are fully visible when its audio starts. Entrance maintains its natural duration without compression to 10%. Transitions are shortened for brief verses. Offsets continue indicating audio bounds; manual animation compensation is unnecessary.

Existing JSON files are loaded when starting the editor, including legacy naming formats. If you adjusted that passage during the session, in-memory values are used first. You can return to the audio cut from verse adjustment; automatic timings are recalculated for the new cut. If previous offsets become invalid, the editor allows returning to the cut or choosing automatic estimates. Discarded adjustments do not modify files or saved sessions. **Closing the CLI before generating the video discards changes that were only in memory.**

During playback: **Enter/Esc** stops, **R** repeats, and **Space** pauses or resumes. **Backspace** returns to the menu from the top; **Ctrl+C** exits. All previews use `mpv` with native pausing without suspending the process via signals. Volume ramps down and up briefly on pause/resume (~80 ms for pause) to prevent audio clicks, and the counter uses player-reported positions. Audio device latency may add delay, especially over Bluetooth.

On macOS, install the player with `brew install mpv`; Homebrew installations are detected automatically. On Linux/Windows, install `mpv` and add it to PATH. You can specify a custom path with `VEOBIBLE_SHORTS_MPV` in `.env`. An interactive terminal is required. Preview WAV files are temporary and deleted when leaving the editor. Configured reading volume is heard; if muted via `volumeMultiplier: 0`, the preview uses original volume to enable timing adjustments. Changing players affects CLI playback only, not source audio or final video.

## Output Files for Publication

Each passage folder is organized as follows:

```text
john-3-14-19/
├── short.mp4
├── thumbnail.jpg
├── youtube.txt
├── x.txt
├── instagram.txt
├── tiktok.txt
└── _internal/
    ├── 0-metadata.txt
    ├── 1-intro.txt
    ├── 1-intro.wav
    ├── 2-passage-audio-offsets.json
    ├── 2-passage-audio-settings.json
    ├── 2-verse-text-offsets.json
    ├── 2-versiculos.txt
    ├── 3-outro.txt
    ├── 3-outro.wav
    └── README.md
```

WAV voiceovers and scripts are generated in `voice` and `mix` modes. `thumbnail.jpg` preserves video resolution and captures the first frame following all intro entrance animations. Its exact second is recorded in `_internal/0-metadata.txt`.

The four root TXT files contain descriptions in the selected language, including reference, version, platform-tailored call to action, website URL, and biblical, book, and theme hashtags derived from passage text. YouTube includes `#Shorts` and Instagram `#Reels`. `x.txt` also includes **all verses in the passage**, untruncated; for long passages this may require a long-form post on X. You can edit text before publishing; descriptions are regenerated on reprocess.

`_internal/README.md` explains each file and how to adjust passage audio offsets and verse text timings with decimal examples.

Prefixes group files: `0-` for general info, `1-` for intro, `2-` for scripture reading, and `3-` for outro.

When reprocessing legacy outputs, the CLI reads offsets and voices from former names in `_internal/`, `internal/`, or root and saves them with new prefixes in `_internal/`, preserving manual adjustments and voices if you choose to reuse them. Edit offsets inside `_internal/` from that point forward.

## Video Composition

Place clips `0-intro.mp4`, `0-outro.mp4`, and one or more backgrounds named `bg-0.mp4`, `bg-1.mp4`, etc., in `<workingDir>/material/videos/`. If using a different directory, set `VEOBIBLE_SHORTS_VIDEOS_DIR`. The CLI picks a background at random, builds a forward-and-reverse loop sequence, and repeats it during reading. `ffmpeg` composes intro, reading, and outro into `short.mp4` with a 0.5-second crossfade for video and audio at each cut. Audio from the selected background is unused.

All three stages share a left-aligned editorial layout and generous margins tailored for short-video interfaces. Intro and outro use ivory and soft gold; reading reverses contrast with a light background and dark ink. Gradual, translucent shading provides contrast without boxing content in cards. The intro highlights "daily dose" (or English/Portuguese equivalents) in large italics, followed by passage reference and version. The reading formats verses in balanced lines and scales text to passage length. The outro presents title, channel name, social accounts in rows, and website URL. Georgia and Avenir are used; `fontconfig` selects alternatives when unavailable.

During reading, shading automatically adapts its palette to the selected background: FFmpeg samples eight points across the clip and clusters their colors into four representative tones. These are tinted to soft paper hues that maintain dark text contrast, blended into elliptical fields with slow-drifting nonlinear gradients. The light surface covers the entire frame: it has 60% opacity behind text and the semibold "V E O B I B L E . C O M" mark, smoothly fading to 12% at top and bottom edges. The `geq` filter included in `ffmpeg-full` generates this animation without external graphic assets or manual configuration.

Animations are generated with FFmpeg: text lines enter with gentle easing, golden accent strokes draw from the left, and exits combine slight drift with fades. Phases adapt to available duration and verse timings. Styling affects only overlay layers, preserving background clips, voices, cuts, and composition timings.

Original Bible audio remains divided by chapter. The CLI estimates start and end times by verse word proportion and uses `ffmpeg` to align boundaries to nearby detected pauses. It concatenates required fragments if the passage spans multiple chapters. The reading segment includes one second of silence before and after Bible audio; 0.5 seconds of each margin overlaps with the crossfade. Pauses alone do not identify verses reliably, so **verify start and end by listening to the generated video**. `_internal/0-metadata.txt` records boundaries before and after adjustments and the selected background filename.

During reading, the video displays each verse individually: first the small reference appears (e.g., `John 3:14`), followed by the large text. Both enter and exit smoothly before advancing to the next. The CLI distributes audio duration by verse word and character counts, nudging boundaries to pauses detected by FFmpeg when nearby. This calculation is an acoustic estimate: FFmpeg does not recognize spoken words, so check synchronization by listening to `short.mp4`.

Each output includes an editable `_internal/2-passage-audio-offsets.json`, initially containing `{"startSeconds": 0, "endSeconds": 0}`. After listening to `short.mp4`, modify `startSeconds` to adjust the start of reading and `endSeconds` to adjust the end; positive numbers move the boundary later in source audio, negative numbers move it earlier. Values are in seconds and add to the automatic boundaries indicated in `_internal/0-metadata.txt`. In **Reprocess complete video**, the CLI preserves the edited file and applies values to the new composition. If the passage crosses chapters, the start offset affects the first chapter and the end offset affects the last. Boundaries must stay within source audio and maintain positive fragment duration.

Each output also includes `_internal/2-verse-text-offsets.json`. Its `verses` array contains the reference, `estimatedStartSeconds`, and `estimatedEndSeconds` for each verse, measured **from the start of the trimmed Bible audio**, excluding the initial one-second silence of reading. Adjust `startOffsetSeconds` and `endOffsetSeconds` to advance (negative value) or delay (positive value) verse appearance and disappearance. For example, if the next verse should enter 0.2 seconds earlier, set its `startOffsetSeconds` to `-0.2` and the preceding verse's `endOffsetSeconds` to `-0.2`. Timings must remain positive, keep each verse duration above zero, and avoid overlaps. When reprocessing, the CLI preserves edited offsets and recalculates estimated timings, even if global offsets were changed in `_internal/2-passage-audio-offsets.json`.

To regenerate an existing video, choose **Reprocess complete video** and confirm overwrite. If the previous output contains `1-intro.wav`, `3-outro.wav`, `1-intro.txt`, and `3-outro.txt` in `_internal/` (or legacy locations in `internal/` or root), the CLI asks if you want to reuse them; **Yes** is the default answer. All four files are copied to the new `_internal/` directory, avoiding rerun of Chatterbox or ElevenLabs calls. If you wish to update voice, samples, or scripts, answer **No** to generate them again. The CLI prepares outputs in a temporary folder, preserving the old output if generation fails. The passage mark in `status.json` is preserved. This option also converts legacy format outputs to the complete video format.

Before **Reprocess complete video**, **Listen to or regenerate intro audio** and **Listen to or regenerate outro audio** appear. Each option opens a menu to listen to current narration (displaying its TXT, with pause and repeat), regenerate it, or return. If audio does not yet exist, playback is disabled and generation is available from the same menu. Regenerate produces only the selected voiceover via Chatterbox or ElevenLabs according to `.env`, using current templates and samples, and updates its WAV and TXT in `_internal/`. It preserves the other voiceover and previous files if generation fails. Then choose **Reprocess complete video** and **Yes** to reuse audio and incorporate the new track into the video (in `voice` or `mix` modes).

Reading volume is configured per passage in `_internal/2-passage-audio-settings.json`: `{"volumeMultiplier": 1}` preserves original volume. It accepts values from `0` to `4`, including decimals; `0` mutes, `1.5` scales amplitude by 1.5, and `2` doubles it. Above `1`, the `alimiter` filter clamps peaks to prevent distortion. The file is preserved on reprocess and only affects reading audio. The `_internal/README.md` guide contains all allowed values and examples.

Each version stores its initial values in `<outputDir>/<versionId>/default-version-settings.json`, structured as:

```json
{
  "volumeMultiplier": 1.5
}
```

The file is created after the first successful render (including reprocessing an existing video), if it does not yet exist, using the volume from that render. Subsequent renders preserve the file. Edit it to set the default volume for new passages in that version; it accepts the same `0` to `4` range. Passages with their own JSON retain their volume on reprocess. Volume adjustment and previews also use the version default when a passage has no configuration.

You can also choose **Adjust reading volume**, located directly below **Adjust audio and verse timings**, both before initial creation and reprocessing. The initial value reflects the last setting in the session, passage JSON, version default, or `1` if none exist. Pressing Enter accepts the displayed value. The setting remains in memory, applies to timing previews, and is saved to JSON when creating or reprocessing; exiting the CLI before rendering discards pending adjustments.

## Intro and Outro Voice

By default, `VEOBIBLE_SHORTS_CLIP_AUDIO_MODE=voice` generates intro and outro voiceovers with Chatterbox or ElevenLabs and layers them over `0-intro.mp4` and `0-outro.mp4`, respectively, replacing original clip audio. With `mix`, voiceovers blend with original audio at reduced volume. With `video`, only embedded MP4 audio is used. **The intro ends one second after its narration; the outro begins with one second of silence and ends one second after its narration.** This also applies to original MP4 audio in `mix` and `video` modes. If background video is longer or shorter, it is trimmed or holds its final frame. Inside `_internal/`, each voiceover is stored as a 24-bit 48 kHz PCM WAV alongside its script; `ffmpeg` uses these WAVs directly in the composition. If synthesis or composition fails, the previous output is preserved. The provider is configured in `.env`.

The outro displays the title "Follow us to hear more" translated into the passage language, channel name, YouTube, X, Instagram, TikTok, and Facebook accounts, and `veobible.com`. Edit [`social-accounts.json`](social-accounts.json) to configure handles per language. YouTube handles correspond to project channels; X, Instagram, and TikTok handles are **examples** that should be replaced before publishing. An empty handle omits that network from the video. Facebook uses the `facebook` key per language; it can be omitted in legacy files. You can specify a different file with the same structure via `VEOBIBLE_SHORTS_SOCIAL_ACCOUNTS` in `.env`.

Spanish, English, and Portuguese templates are edited in [voice-templates.json](voice-templates.json) within this tool. They support `{reference}`, `{version}`, `{book}`, `{start}`, `{end}`, and `{passage_id}`. Values come from the selected passage and version; `shorts-daily-dose` passes full scripts to [VeoBible Voice](../voice-generator/README.md), which only synthesizes the text provided.

In voiceovers, `{reference}` spells out numbers in words (e.g., "John chapter three verses fourteen through nineteen"). It also converts numbered books like "1 John" to "First John". `_internal/0-metadata.txt` preserves written reference format "John 3:14-19". After editing templates or switching providers, use **Reprocess complete video** and choose to generate narrations again to update output.

### Local Chatterbox

Install dependencies first in the dedicated environment of [VeoBible Voice](../voice-generator/README.md). `shorts-daily-dose` automatically uses `tools/voice-generator/.venv/bin/python` and runs its `cli.py`; you do not need to set `VEOBIBLE_SHORTS_TTS_PYTHON` unless you use a different environment path. You can select `latam` only for Spanish via `VEOBIBLE_SHORTS_TTS_MODEL_ES` or use a different templates JSON via `VEOBIBLE_SHORTS_TTS_TEMPLATES`. Final WAVs are 24-bit 48 kHz PCM.

During local generation, the terminal displays the current stage and elapsed time. Download messages, warnings, and internal Chatterbox progress bars are suppressed; if generation fails, technical error details are displayed.

### Voice Samples by Language

Voice samples reside outside the repository in `<workingDir>/material/voices/`. For each language, a dedicated track sample is looked up first: `es-intro.mp3` and `es-outro.mp3`, `en-intro.mp3` and `en-outro.mp3`, or `pt-intro.mp3` and `pt-outro.mp3`. `.wav` files are also accepted. If a dedicated sample is missing, the general sample for that language is used (`es.mp3`, `en.mp3`, or `pt.mp3`; also `.wav`). You can configure general paths in `tools/shorts-daily-dose/.env`:

```dotenv
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES=/Users/fabian/Documents/veobible-shorts/material/voices/es.mp3
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN=/Users/fabian/Documents/veobible-shorts/material/voices/en.mp3
VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT=/Users/fabian/Documents/veobible-shorts/material/voices/pt.mp3
```

Each sample should ideally contain **5–10 seconds of clear speech**, free of music or background noise, in the corresponding language. WAV or MP3 are accepted. For custom dedicated paths, use `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES_INTRO` and `_ES_OUTRO` (or EN/PT equivalents). If a per-language variable is unset, `VEOBIBLE_SHORTS_TTS_VOICE_PROMPT` is used if defined; otherwise, the default general file is sought. A dedicated variable explicitly set to empty uses the model default voice for that track; an empty general variable disables fallback only. The CLI verifies that selected paths exist prior to synthesis.

Multilingual Chatterbox supports Portuguese with `language_id="pt"`. Resemble AI also provides dedicated models for [Brazilian Portuguese](https://huggingface.co/ResembleAI/Chatterbox-Multilingual-pt-br) and [European Portuguese](https://huggingface.co/ResembleAI/Chatterbox-Multilingual-pt-pt). This integration currently uses the multilingual model for Portuguese; if no dedicated sample is found, `pt.mp3` is used as fallback. For Latin American Spanish, you can set `VEOBIBLE_SHORTS_TTS_MODEL_ES=latam` without affecting English or Portuguese models.

### ElevenLabs

To use the API, define `VEOBIBLE_SHORTS_TTS_PROVIDER=elevenlabs`, `VEOBIBLE_SHORTS_ELEVENLABS_API_KEY`, and voice IDs `VEOBIBLE_SHORTS_ELEVENLABS_VOICE_ES`, `_EN`, and `_PT` in `.env`. Only the voice ID for the language you are generating is required. The default model is `eleven_multilingual_v2`; you can override it with `VEOBIBLE_SHORTS_ELEVENLABS_MODEL`. Find voice IDs in your [ElevenLabs Voice Library](https://elevenlabs.io/app/voice-library). Each intro and outro makes one API request. The MP3 response is converted with `ffmpeg` to 24-bit 48 kHz PCM WAV. Chatterbox is not required for this option.

When switching providers, choose **Reprocess complete video** and answer **No** to audio reuse to compose output with new voiceovers.

### Text Display During Full Playback

**Play complete passage** displays all verses of the passage with their references, highlighted and marked as **PASSAGE**. It includes up to two preceding and two succeeding verses, when present in the same book, dimmed and marked as **CONTEXT**, even across neighboring chapters. Audio remains the trimmed passage cut. You can scroll through text without interrupting playback using **↑/↓**, **PgUp/PgDn**, and **Home/End**.
