# Scripts

Utility scripts for the veobible-app project.

---

## `generate-book-json.py`

Generates one JSON file per Bible **book** by merging the existing per-chapter
JSON files that live inside a Bible version directory.

### Why this exists

The app stores Bible content as individual chapter files
(`/bible-data/{lang}/{version}/{book}/{chapter}.json`).  This is ideal for
SSG page rendering (each chapter page only loads what it needs), but it means
the in-browser **search** and **offline download** features have to make up to
1,189 separate network requests to cover the whole Bible.

By generating one file per book (`genesis.json`, `exodus.json`, …), the same
operations require only **66 requests** — an ~18× reduction.  The per-chapter
files are left intact, so SSG pages continue to work without modification.

### Output format

Each per-book file is a compact JSON object whose keys are chapter numbers
(as strings) and whose values are the verse arrays from the original chapter
files:

```json
{
  "1": [{"verse": 1, "text": "In the beginning..."}, ...],
  "2": [{"verse": 1, "text": "..."}, ...],
  ...
}
```

Files are written to the **root** of the version directory, alongside
`index.json`:

```text
public/bible-data/es/rv1909/
  index.json
  genesis.json          ← generated (all 50 chapters merged)
  exodus.json           ← generated
  ...
  genesis/              ← untouched
    1.json
    2.json
    ...
```

### Requirements

- Python 3.8+ (no external dependencies — uses only the standard library)

### Usage

Run from the project root (`veobible-app/`):

```bash
# Generate per-book files for the Spanish RV1909 version:
python3 scripts/generate-book-json.py public/bible-data/es/rv1909

# Generate for the English KJV version:
python3 scripts/generate-book-json.py public/bible-data/en/kjv

# Preview what would be generated without writing any files:
python3 scripts/generate-book-json.py public/bible-data/es/rv1909 --dry-run

# Overwrite existing files (useful after updating chapter JSONs):
python3 scripts/generate-book-json.py public/bible-data/es/rv1909 --force

# Write human-readable JSON (useful for debugging, larger files):
python3 scripts/generate-book-json.py public/bible-data/es/rv1909 --pretty
```

### Options

| Flag | Description |
| ------ | ------------- |
| `--dry-run` | Print what would be written without creating any files |
| `--force` | Overwrite existing per-book JSON files (default: skip) |
| `--pretty` | Write indented JSON (human-readable but ~15% larger) |

### Exit codes

| Code | Meaning |
| ------ | --------- |
| `0` | All books processed successfully |
| `1` | Fatal error (version directory not found, malformed `index.json`) |
| `2` | One or more chapter files were missing or unreadable (partial success) |

### Output example

```text
Generating per-book JSON files for: /path/to/public/bible-data/es/rv1909

  [ok]      genesis.json      (50 chapters, 243.2 KB)
  [ok]      exodus.json       (40 chapters, 202.1 KB)
  [ok]      leviticus.json    (27 chapters, 165.8 KB)
  ...
  [ok]      revelation.json   (22 chapters, 72.1 KB)

Done.
```

### When to re-run

Re-run the script (with `--force`) whenever the per-chapter JSON source files
are updated. The generated per-book files are checked in to the repository so
they are served as static assets — no build step required.

---

## `normalize-audio-filenames.py`

Recursively traverses a directory and renames `.mp3` files that don't follow the canonical naming format, stripping any extra suffix added by audio optimization tools.

### Canonical format

```text
[NN]-[text]-[N].mp3
```

| Segment | Description | Example |
| --- | --- | --- |
| `NN` | Book number, zero-padded to at least 2 digits | `01`, `10`, `66` |
| `text` | Book identifier (lowercase letters and hyphens) | `genesis`, `1-samuel` |
| `N` | Chapter number, no leading zeros | `1`, `12`, `150` |

**Example rename:**

```text
01-genesis-1-esv2-100p-bg-m-music-m.mp3  →  01-genesis-1.mp3
```

### Requirements

- Python 3 (no external dependencies)

### Usage

```bash
# Preview changes without renaming any files (recommended first):
python3 scripts/normalize-audio-filenames.py <path> --dry-run

# Apply renaming:
python3 scripts/normalize-audio-filenames.py <path>
```

Replace `<path>` with the root directory to traverse. The script walks all subdirectories recursively.

### Behavior

- Files already matching the canonical format are **left untouched**.
- Files whose name starts with a valid canonical prefix are **renamed** by discarding everything after the prefix.
- Files with no recognizable canonical prefix are **skipped** and reported.
- If the target filename already exists, the file is **skipped** with an error message to avoid data loss.

### Output example

```text
Traversing: /path/to/audio (DRY RUN — no files will be changed)

  [Would rename] '01-genesis-1-esv2-100p-bg-m-music-m.mp3'  →  '01-genesis-1.mp3'
                 in /path/to/audio/rv1909/genesis
  [SKIP] No canonical prefix found: /path/to/audio/rv1909/cover.mp3

Done (dry run):
  Already canonical : 150
  Renamed           : 12
  Skipped (no match): 1
  Errors            : 0
```

---

## `import-youtube-videos.py`

Automatically fetches the latest video uploads from configured YouTube channels via RSS feeds and associates their watch URLs with the corresponding Bible books in their respective `index.json` files.

### Configuration

At the top of the script, you can configure the mapping between local Bible version directories and YouTube channel URLs, as well as the release date threshold and the delay between requests to avoid rate limiting:

```python
# List of configurations mapping a Bible version directory to its corresponding YouTube channel URL.
CONFIG = [
    {
        "bible_data_path": "public/bible-data/es/rv1909",
        "youtube_channel": "https://www.youtube.com/@veobible-es"
    },
    ...
]

# Only consider videos published on or after this date (YYYY-MM-DD)
MIN_PUBLISH_DATE = "2026-05-26"

# Time delay (in seconds) between requests to respect YouTube rate limits
REQUEST_DELAY_SECONDS = 2
```

### Requirements

- Python 3 (uses only standard library modules: `urllib`, `xml.etree.ElementTree`, `unicodedata`, etc.)
- Active internet connection (to fetch channel pages and RSS feeds)

### Usage

Run from the project root (`veobible-app/`):

```bash
python3 scripts/import-youtube-videos.py
```

### How it works

1. **Resolves Channel IDs:** Dynamically parses the configured YouTube channel URLs (including handles like `@veobible`) to retrieve their corresponding channel ID (`UC...`).
2. **Retrieves RSS Feeds:** Requests the official YouTube XML feed for the resolved channel IDs.
3. **Filters by Date:** Excludes any video published prior to the configured `MIN_PUBLISH_DATE`.
4. **Matches Book Names:** Extracts the first segment of the video title (splitting by `|`) and performs a normalized comparison (case-insensitive and accent-insensitive) against the book names in the Bible version's `index.json`.
5. **Updates Metadata:** If a matching book has an empty `"video"` field, it is updated with the video's watch URL. Existing non-empty video URLs are preserved, and any updates are saved back to `index.json`.
