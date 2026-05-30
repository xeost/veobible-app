# Scripts

Utility scripts for the veobible-app project.

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
