# Audiobibles CLI

A command-line tool to automate the production of audiobible videos for [veobible.com](https://veobible.com).

Each video corresponds to one book of the Bible in a specific version (e.g. Genesis in Reina Valera 1909). The tool concatenates all per-chapter audio files into a single audio track, composites it over a static thumbnail image with an audio visualizer, and outputs a ready-to-upload MP4 alongside the thumbnail and a YouTube description file.

## Key Features

1. **Interactive Menu:** Elegant CLI that guides you through every production step.
2. **Bible Version Support:** Works with any Bible version registered in `src/config.ts`. Currently includes RV 1909 (Spanish) and KJV (English).
3. **Multi-chapter Audio Concat:** Automatically concatenates all chapter MP3 files in the correct order using FFmpeg's concat demuxer.
4. **JSON Filter Workflow:** Same filtering mechanism as `podcasts-cli` — run Step 1 to generate metadata files, delete the books you want to skip, proceed with Steps 2–4.
5. **Clipboard Handling:** Copies image-generation prompts to clipboard and opens Gemini automatically.
6. **Validation:** Verifies that all chapter audios and the book image are present before rendering.
7. **Scheduled Dates:** Calculates the YouTube upload date based on a configurable base date and days-per-book interval.

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
|---|---|---|
| `AUDIOBIBLES_WORKING_DIR` | `material/audiobibles` | Working directory (sources, outputs, logs) |
| `AUDIOBIBLES_BIBLE_DATA_DIR` | `public/bible-data` | Path to the Bible index JSON files |

The **working directory** must follow this structure:

```
<workingDir>/
  sources/
    metadata/
      <versionId>/           ← JSON metadata files (created by Step 1)
        01-genesis.json
    audios/
      <versionId>/           ← Chapter MP3 files
        01-genesis-1.mp3
        01-genesis-2.mp3
        …
    images/
      <versionId>/           ← Book thumbnail images
        01-genesis.jpeg
  outputs/                   ← Generated videos + thumbnails + upload txt
  logs/                      ← Daily log files
```

### 2. Bible Versions

Edit the `versions` array in `src/config.ts` to add or remove Bible versions:

```typescript
versions: [
  { id: "rv1909", locale: "es", label: "Reina Valera 1909", shortLabel: "RV 1909" },
  { id: "kjv",    locale: "en", label: "King James Version", shortLabel: "KJV" },
],
```

Each version must have a corresponding `index.json` file at:
```
public/bible-data/<locale>/<id>/index.json
```

### 3. Scheduling

Configure the upload schedule in `src/config.ts`:

```typescript
schedule: {
  baseDate: "2026-06-01",   // Book 1 of any version is scheduled starting from this date
  publishDays: ["Wednesday", "Friday", "Sunday"], // Weekdays to publish videos (array or comma-separated string)
  scheduledTime: "3:30 PM", // Time shown in the upload info file
},
```

The schedule is independent per version. Book 1 maps to the first available publish day on or after `baseDate`, book 2 to the next publish day, etc.

### 4. Video Generation

Customize the audio visualizer and output quality in `src/config.ts`:

| Setting | Options | Default |
|---|---|---|
| `visualizer.style` | `bars`, `wave`, `circle`, `spectrum` | `wave` |
| `visualizer.color` | Hex color | `#00FFAA` |
| `video.output.resolution` | e.g. `1920x1080` | `1920x1080` |
| `video.output.fps` | Number | `30` |
| `video.output.crf` | 0–51 (lower = better quality) | `22` |

### 5. Gemini Chat URL

The single Gemini URL opened during Step 2 is configurable:

```typescript
geminiChatUrl: "https://gemini.google.com/app",
```

## File Naming Conventions

Source and output files follow these patterns:

| File type | Pattern | Example |
|---|---|---|
| Chapter audio | `sources/audios/<versionId>/<NN>-<bookId>-<chapter>.mp3` | `01-genesis-1.mp3` |
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
Runs automatically on launch. Select the Bible version, enter the default book number (the last processed book number is suggested from `last-book-<versionId>.log`), and choose whether to use the same book number for all books or assign numbers individually.

### Step 1 — Create Book JSON Files
Writes one `.json` metadata file per targeted book to `sources/metadata/<versionId>/`. Each file contains the book name, description, version info, chapter count, and veobible.com URL.

**Filtering trick:** After Step 1, you can manually delete the `.json` files of books you do _not_ want to process that day. Steps 2–4 will automatically skip books without a `.json` file.

### Step 2 — Copy Image Prompts (Gemini)
For each book with a `.json` file (and no image yet):
1. Generates a rich image-creation prompt and copies it to the clipboard.
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

- **Title:** `<BookName> | <VersionLabel>`  
  Example: `Génesis | Reina Valera 1909`

- **Description:**
  1. Description of the book (from `index.json`)
  2. Section about the Bible version (name, description)
  3. Link to the book on veobible.com

- **Scheduled date** calculated from the configured schedule.

## Development

```bash
cd audiobibles-cli
pnpm install
pnpm start          # Run the CLI
pnpm dev            # Run with file watching (tsx watch)
```
