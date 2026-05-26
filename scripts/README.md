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
