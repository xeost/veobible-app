# Audiobibles CLI

A command-line tool to automate the production of audiobible videos for [veobible.com](https://veobible.com).

Each video corresponds to one book of the Bible in a specific version (e.g. Genesis in Reina Valera 1909, KJV, or ARC). The tool concatenates all per-chapter audio files into a single audio track, composites it over a static thumbnail image with an audio visualizer, and outputs a ready-to-upload MP4 alongside the thumbnail and a YouTube description file.

## Key Features

1. **Interactive Menu:** Elegant CLI that guides you through every production step.
2. **Bible Version & Multi-language Content Support:** Works with any Bible version registered in `src/config.ts`. Automatically generates localized YouTube titles, descriptions, and Gemini cover prompts based on version locale (`es`, `en`, `pt`, easily extensible via `src/i18n.ts`). Currently includes RV 1909 (Spanish), KJV (English), and ARC (Portuguese).
3. **Multi-chapter Audio Concat:** Automatically concatenates all chapter audio files (`.mp3`, `.m4a`) in the correct order using FFmpeg's concat demuxer.
4. **JSON Filter Workflow:** Same filtering mechanism as `podcasts-cli` — run Step 1 to generate metadata files, delete the books you want to skip, proceed with Steps 2–4.
5. **Clipboard Handling:** Copies image-generation prompts in the version's language to clipboard and opens Gemini automatically.
6. **Validation:** Verifies that all chapter audios and the book image are present before rendering.
7. **Scheduled Dates & Per-version Overrides:** Calculates the YouTube upload date based on global schedule defaults or per-version schedule overrides.

## Prerequisites

- **FFmpeg** and **ffprobe** (part of the FFmpeg suite) installed and in your `PATH`.
- **Node.js** ≥ 18 and **pnpm**.

```bash
brew install ffmpeg
```

## Configuration

### 1. Directories

Edit `src/config.ts` or set environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `AUDIOBIBLES_WORKING_DIR` | `material/audiobibles` | Working directory (sources, outputs, logs) |
| `AUDIOBIBLES_BIBLE_DATA_DIR` | `public/bible-data` | Path to the Bible index JSON files |

The **working directory** must follow this structure:

```text
<workingDir>/
  sources/
    metadata/
      <versionId>/           ← JSON metadata files (created by Step 1)
        01-genesis.json
    audios/
    audios/
      <versionId>/           ← Chapter audio files (.mp3, .m4a)
        01-genesis-1.mp3
        01-genesis-2.m4a
        …
    images/
      <versionId>/           ← Book thumbnail images
        01-genesis.jpeg
  outputs/                   ← Generated videos + thumbnails + upload txt
  logs/                      ← Daily log files
```

### 2. Bible Versions & Scheduling Overrides

Edit the `versions` array in `src/config.ts` to add or remove Bible versions:

```typescript
versions: [
  {
    id: "rv1909",
    locale: "es",
    label: "Reina Valera 1909",
    shortLabel: "RV 1909",
  },
  {
    id: "kjv",
    locale: "en",
    label: "King James Version",
    shortLabel: "KJV",
    youtubeLabel: "KJV",
  },
  {
    id: "arc",
    locale: "pt",
    label: "Almeida Revista e Corrigida",
    shortLabel: "ARC",
    youtubeLabel: "ARC",
    schedule: {
      baseDate: "2026-07-22", // Per-version schedule override
    },
  },
],
```

Each version must have a corresponding `index.json` file at:

```text
public/bible-data/<locale>/<id>/index.json
```

### 3. Scheduling

Configure global default scheduling in `src/config.ts`:

```typescript
schedule: {
  baseDate: "2026-06-05",   // Default anchor date for Book 1
  publishDays: [            // Weekdays to publish videos (English day names or 0-6)
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
  scheduledTime: "9:00 AM", // Upload time shown in info file
},
```

- Global schedule settings serve as fallbacks.
- Any version can individually override `baseDate`, `publishDays`, or `scheduledTime` inside its `schedule` object in `src/config.ts`.
- Book 1 maps to the first available publish day on or after `baseDate`, book 2 to the next publish day, etc.

### 4. Internationalization (i18n)

Content generation (YouTube titles, descriptions, read online links, chapter headers, and Gemini cover image prompts) is managed by `src/i18n.ts`:

- **Supported Locales:** `es` (Spanish), `en` (English), `pt` (Portuguese).
- **Extensibility:** To add support for a new language, add an entry to the `locales` object in `src/i18n.ts`. Unrecognised locales gracefully fall back to English (`en`).
- **CLI Configuration:** The CLI interface and configuration options (`config.ts`, `publishDays`) remain strictly in English.

### 5. Video Generation

Customize the audio visualizer and output quality in `src/config.ts`:

| Setting | Options | Default |
| --- | --- | --- |
| `visualizer.style` | `bars`, `wave`, `circle`, `spectrum` | `wave` |
| `visualizer.color` | Hex color | `#ffffff` |
| `video.output.resolution` | e.g. `1920x1080` | `1920x1080` |
| `video.output.fps` | Number | `30` |
| `video.output.crf` | 0–51 (lower = better quality) | `22` |

### 6. Gemini Chat URL

The single Gemini URL opened during Step 2 is configurable:

```typescript
geminiChatUrl: "https://gemini.google.com/app",
```

## File Naming Conventions

Source and output files follow these patterns:

| File type | Pattern | Example |
| --- | --- | --- |
| Chapter audio | `sources/audios/<versionId>/<NN>-<bookId>-<chapter>.<ext>` | `01-genesis-1.mp3` or `.m4a` |
| Book image | `sources/images/<versionId>/<NN>-<bookId>.<ext>` | `01-genesis.jpeg` |
| JSON metadata | `sources/metadata/<versionId>/<NN>-<bookId>.json` | `01-genesis.json` |
| Output video | `outputs/<versionId>-<NN>-<bookId>-1.mp4` | `rv1909-01-genesis-1.mp4` |
| Thumbnail copy | `outputs/<versionId>-<NN>-<bookId>-2-thumb.<ext>` | `rv1909-01-genesis-2-thumb.jpeg` |
| Upload info | `outputs/<versionId>-<NN>-<bookId>-3-upload.txt` | `rv1909-01-genesis-3-upload.txt` |

The `<bookId>` is the English lowercase book identifier as found in the Bible index (e.g. `genesis`, `1-samuel`, `song-of-solomon`).

## Usage

Run from the project root:

```bash
pnpm audiobibles
```

Or specify the starting book number directly:

```bash
pnpm audiobibles --book 3
```

## Workflow (Steps)

### Step 0 — Session Setup

Runs automatically on launch. Select the Bible version and choose the generation scope:
- **Specific book**: Enter a specific book number (suggests next book from `last-book-<versionId>.log`) to generate 1 video for that book.
- **All books (1 video per book)**: Targets all books in the version to generate an individual video for each book with ready source files.
- **Old Testament (single video)**: Concatenates all Old Testament books into one single video.
- **New Testament (single video)**: Concatenates all New Testament books into one single video.
- **Complete Bible (single video)**: Concatenates all books of the Bible into one single video.

### Step 1 — Create Book JSON Files

Writes one `.json` metadata file per targeted book to `sources/metadata/<versionId>/`. Each file contains the book name, description, version info, chapter count, and veobible.com URL.

**Filtering trick:** After Step 1, you can manually delete the `.json` files of books you do _not_ want to process that day. Steps 2–4 will automatically skip books without a `.json` file.

### Step 2 — Copy Image Prompts (Gemini)

For each book with a `.json` file (and no image yet):

1. Generates a rich image-creation prompt in the version's language and copies it to the clipboard.
2. Opens the configured Gemini URL in the browser.
3. Waits for you to generate and save the thumbnail before moving to the next book.

Save thumbnails to: `sources/images/<versionId>/<NN>-<bookId>.<ext>`

### Step 3 — Verify Source Files

Checks that all chapter MP3 files and the thumbnail image are present for each targeted book. Displays a readiness table and shows which chapters are missing. Loops until all files are present or you cancel.

### Step 4 — Generate Videos (FFmpeg)

For each ready book:

1. Concatenates all chapter MP3 files in numerical order.
2. Renders a video with the audio visualizer over the static thumbnail.
3. Writes the `.mp4`, thumbnail copy, and upload info `.txt` to `outputs/`.
4. Saves the last processed book number to `logs/last-book-<versionId>.log`.

### Upload Info Format (`.txt`)

The generated upload info file contains:

- **Title:** `<BookName> | <BibleTerm> | <VersionLabel> | <AudioBibleTerm>`  
  Examples:  
  - ES: `Génesis | Santa Biblia | Reina Valera 1909 | Audio Biblia`  
  - EN: `Genesis | Holy Bible | KJV | Audio Bible`  
  - PT: `Gênesis | Bíblia Sagrada | ARC | Bíblia em Áudio`

- **Description:**
  1. Description of the book (from `index.json`)
  2. Localized section about the Bible version (name, description)
  3. Localized link to read online at veobible.com
  4. YouTube chapter markers with localized chapter labels (`📌 Capítulos` / `📌 Chapters`)

- **Scheduled date & time** calculated from global schedule or version overrides.

## Development

```bash
cd audiobibles-cli
pnpm install
pnpm start          # Run the CLI
pnpm dev            # Run with file watching (tsx watch)
```
