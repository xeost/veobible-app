#!/usr/bin/env python3
"""
normalize-audio-filenames.py

Recursively traverses a directory and renames any .mp3 file whose name does
not exactly match the canonical format:

    [NN]-[text]-[N].mp3

Rules:
  - The first number is zero-padded to at least 2 digits  (e.g. "01", "10").
  - The second number has NO leading zeros               (e.g. "1", "12").
  - The middle segment is one or more lowercase letters/hyphens (word text).

Files that already match the canonical format are left untouched.
Files whose base name *starts with* a valid canonical prefix are renamed by
stripping the extra suffix (e.g. "01-genesis-1-esv2-100p-bg-m-music-m.mp3"
→ "01-genesis-1.mp3").

Usage:
    python3 normalize-audio-filenames.py <directory_path> [--dry-run]

Options:
    --dry-run   Print what would be renamed without actually renaming anything.
"""

import argparse
import os
import re
import sys


# Matches the canonical format exactly: NN-text-N.mp3
CANONICAL_RE = re.compile(
    r'^(\d{2,})-([a-z][a-z0-9-]*[a-z0-9]|[a-z])-(\d+)\.mp3$',
    re.IGNORECASE,
)

# Captures a canonical-looking prefix at the start of any filename.
# The first number must be at least 2 digits (zero-padded).
# The middle text is letters/hyphens.
# The trailing chapter number has no leading zeros.
PREFIX_RE = re.compile(
    r'^(\d{2,})-([a-z][a-z0-9-]*[a-z0-9]|[a-z])-(0*([1-9]\d*))(?=[-.])',
    re.IGNORECASE,
)


def canonical_name(book_num: str, book_text: str, chapter_num: str) -> str:
    """Build the canonical filename from its three components."""
    # Ensure book number is zero-padded to at least 2 digits.
    padded = str(int(book_num)).zfill(2)
    # Ensure chapter number has no leading zeros.
    chapter = str(int(chapter_num))
    return f"{padded}-{book_text.lower()}-{chapter}.mp3"


def process_directory(root_path: str, dry_run: bool) -> None:
    renamed = 0
    skipped = 0
    already_ok = 0
    errors = 0

    for dirpath, _dirnames, filenames in os.walk(root_path):
        for filename in sorted(filenames):
            if not filename.lower().endswith('.mp3'):
                continue

            filepath = os.path.join(dirpath, filename)

            # Already matches canonical format — nothing to do.
            if CANONICAL_RE.match(filename):
                already_ok += 1
                continue

            # Try to extract the canonical prefix from the filename.
            match = PREFIX_RE.match(filename)
            if not match:
                print(f"  [SKIP] No canonical prefix found: {filepath}")
                skipped += 1
                continue

            book_num = match.group(1)
            book_text = match.group(2)
            chapter_num = match.group(4)  # group 4 strips leading zeros

            new_name = canonical_name(book_num, book_text, chapter_num)
            new_path = os.path.join(dirpath, new_name)

            if new_name == filename:
                # Should not happen (caught by CANONICAL_RE above), but guard anyway.
                already_ok += 1
                continue

            # Avoid overwriting an existing file.
            if os.path.exists(new_path):
                print(f"  [ERROR] Target already exists, skipping: {new_path}")
                errors += 1
                continue

            action = "Would rename" if dry_run else "Renaming"
            print(f"  [{action}] {filename!r}  →  {new_name!r}")
            print(f"            in {dirpath}")

            if not dry_run:
                try:
                    os.rename(filepath, new_path)
                    renamed += 1
                except OSError as exc:
                    print(f"  [ERROR] Failed to rename: {exc}")
                    errors += 1
            else:
                renamed += 1

    # Summary
    mode = "(dry run)" if dry_run else ""
    print()
    print(f"Done {mode}:")
    print(f"  Already canonical : {already_ok}")
    print(f"  Renamed           : {renamed}")
    print(f"  Skipped (no match): {skipped}")
    print(f"  Errors            : {errors}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rename audio files to the canonical [NN]-[text]-[N].mp3 format.",
    )
    parser.add_argument(
        "path",
        help="Root directory to traverse recursively.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without renaming any files.",
    )
    args = parser.parse_args()

    root = os.path.abspath(args.path)
    if not os.path.isdir(root):
        print(f"Error: '{root}' is not a valid directory.", file=sys.stderr)
        sys.exit(1)

    mode_label = " (DRY RUN — no files will be changed)" if args.dry_run else ""
    print(f"Traversing: {root}{mode_label}")
    print()

    process_directory(root, args.dry_run)


if __name__ == "__main__":
    main()
