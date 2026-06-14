#!/usr/bin/env python3
"""
generate-book-json.py
=====================
Generates one JSON file per Bible book by merging the existing per-chapter
JSON files found inside a Bible version directory.

The output format is a compact object whose keys are chapter numbers (as
strings) and whose values are the verse arrays already present in the
individual chapter files.

Output structure
----------------
{
  "genesis.json": {
    "1": [ {"verse": 1, "text": "..."}, ... ],
    "2": [ {"verse": 1, "text": "..."}, ... ],
    ...
  },
  ...
}

Each per-book file is written to the *root* of the version directory, next
to the existing ``index.json``.  The per-chapter files are left untouched,
so the SSG reader pages continue to work without any code changes.

Usage
-----
    python3 scripts/generate-book-json.py <version-dir>

Where <version-dir> is the path to a specific Bible version, e.g.:

    python3 scripts/generate-book-json.py public/bible-data/es/rv1909
    python3 scripts/generate-book-json.py public/bible-data/en/kjv

Options
-------
    --dry-run   Print what would be written without creating any files.
    --force     Overwrite existing per-book JSON files (default: skip).
    --pretty    Write indented JSON (larger files, useful for debugging).
    --help      Show this message and exit.

Exit codes
----------
    0   All books processed successfully.
    1   Fatal error (e.g. version directory not found, malformed index.json).
    2   One or more chapter files were missing or unreadable (partial success).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(path: Path) -> object:
    """Load and parse a JSON file, raising a descriptive RuntimeError on failure."""
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise RuntimeError(f"File not found: {path}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in {path}: {exc}")


def chapter_files_for_book(book_dir: Path, chapter_count: int) -> list[tuple[int, Path]]:
    """
    Return a list of (chapter_number, path) tuples for a book directory.

    Chapters are listed in ascending order.  Missing chapter files are
    included in the list with a None path so the caller can report them.
    """
    result: list[tuple[int, Path]] = []
    for ch in range(1, chapter_count + 1):
        p = book_dir / f"{ch}.json"
        result.append((ch, p))
    return result


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def generate_book_json(
    version_dir: Path,
    *,
    dry_run: bool = False,
    force: bool = False,
    pretty: bool = False,
) -> int:
    """
    Process all books in *version_dir* and write per-book JSON files.

    Returns the number of chapter files that could not be read (0 = success).
    """
    index_path = version_dir / "index.json"
    index = load_json(index_path)  # raises RuntimeError on failure

    books: list[dict] = index.get("books", [])
    if not books:
        raise RuntimeError(f"No 'books' array found in {index_path}")

    missing_chapters = 0
    separator = json.dumps(None, indent=2 if pretty else None)  # placeholder

    for book in books:
        book_id: str = book["id"]          # e.g. "genesis"
        chapter_count: int = book["chapters"]

        book_dir = version_dir / book_id
        output_path = version_dir / f"{book_id}.json"

        # Skip if already exists and --force not set
        if output_path.exists() and not force:
            print(f"  [skip]    {output_path.name}  (already exists, use --force to overwrite)")
            continue

        chapters_data: dict[str, list] = {}
        chapter_pairs = chapter_files_for_book(book_dir, chapter_count)

        for ch_num, ch_path in chapter_pairs:
            if not ch_path.exists():
                print(f"  [missing] {ch_path}  (chapter {ch_num} skipped)", file=sys.stderr)
                missing_chapters += 1
                continue
            try:
                verses = load_json(ch_path)
                if not isinstance(verses, list):
                    print(
                        f"  [warn]    {ch_path}  expected a list, got {type(verses).__name__}",
                        file=sys.stderr,
                    )
                chapters_data[str(ch_num)] = verses
            except RuntimeError as exc:
                print(f"  [error]   {exc}", file=sys.stderr)
                missing_chapters += 1

        if dry_run:
            total_verses = sum(len(v) for v in chapters_data.values())
            print(
                f"  [dry-run] Would write {output_path.name}"
                f"  ({len(chapters_data)} chapters, {total_verses} verses)"
            )
            continue

        # Write the merged file
        indent = 2 if pretty else None
        separators = None if pretty else (",", ":")  # compact separators save ~15% size

        with output_path.open("w", encoding="utf-8") as fh:
            json.dump(chapters_data, fh, ensure_ascii=False, indent=indent, separators=separators)

        size_kb = output_path.stat().st_size / 1024
        print(f"  [ok]      {output_path.name}  ({len(chapters_data)} chapters, {size_kb:.1f} KB)")

    return missing_chapters


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="generate-book-json",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "version_dir",
        metavar="<version-dir>",
        help="Path to the Bible version directory (contains index.json and book subdirs).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be written without creating any files.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing per-book JSON files.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Write indented, human-readable JSON (larger file size).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    version_dir = Path(args.version_dir).resolve()
    if not version_dir.is_dir():
        print(f"Error: '{version_dir}' is not a directory.", file=sys.stderr)
        return 1

    index_path = version_dir / "index.json"
    if not index_path.exists():
        print(f"Error: 'index.json' not found in '{version_dir}'.", file=sys.stderr)
        return 1

    mode = "DRY-RUN " if args.dry_run else ""
    print(f"\n{mode}Generating per-book JSON files for: {version_dir}\n")

    try:
        missing = generate_book_json(
            version_dir,
            dry_run=args.dry_run,
            force=args.force,
            pretty=args.pretty,
        )
    except RuntimeError as exc:
        print(f"\nFatal error: {exc}", file=sys.stderr)
        return 1

    if missing:
        print(f"\nDone with {missing} missing/unreadable chapter file(s).", file=sys.stderr)
        return 2

    print("\nDone." if not args.dry_run else "\nDry-run complete. No files were written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
