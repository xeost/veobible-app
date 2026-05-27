#!/usr/bin/env python3
"""
clean-bible-text.py

Recursively traverses a directory containing Bible chapter JSON files and applies corrections to verse texts:
1. Removes square brackets enclosing words, leaving only the inner word(s).
   Example: "[was]" -> "was", "[it was]" -> "it was"
2. Capitalizes the first word of a verse if it is currently in all-caps, 
   changing it to title-case (first letter uppercase, rest lowercase).
   Example: "EN el principio" -> "En el principio"
            "¶ THEN the Lord" -> "¶ Then the Lord"

Usage:
    python3 clean-bible-text.py <directory_path> [--dry-run]
"""

import argparse
import os
import json
import re
import sys

def clean_verse_text(text: str) -> tuple[str, bool]:
    """
    Applies the two cleanup rules to the verse text.
    Returns a tuple: (modified_text, was_changed)
    """
    original = text
    
    # Rule 1: Remove square brackets around words, keeping the inner text.
    # Pattern explanation: \[ matches '[', ([^\]]+) captures any char except ']', and \] matches ']'
    text = re.sub(r'\[([^\]]+)\]', r'\1', text)
    
    # Rule 2: Find the first word (sequence of Unicode letters) and if it is all uppercase,
    # convert it to title-case (first letter uppercase, subsequent letters lowercase).
    # [^\W\d_] matches any Unicode letter.
    first_word_match = re.search(r'([^\W\d_]+)', text)
    if first_word_match:
        word = first_word_match.group(1)
        if word.isupper():
            new_word = word[0].upper() + word[1:].lower()
            if new_word != word:
                start, end = first_word_match.span(1)
                text = text[:start] + new_word + text[end:]
                
    return text, text != original

def process_file(filepath: str, dry_run: bool) -> int:
    """
    Processes a single Bible chapter JSON file.
    Returns the number of modified verses.
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading file {filepath}: {e}", file=sys.stderr)
        return 0
        
    # Validation: the file must be a JSON array containing dictionaries with 'verse' and 'text'.
    if not isinstance(data, list):
        return 0
        
    modified_verses = 0
    modified_data = []
    
    for item in data:
        if not isinstance(item, dict) or 'text' not in item or 'verse' not in item:
            modified_data.append(item)
            continue
            
        original_text = item['text']
        new_text, changed = clean_verse_text(original_text)
        
        if changed:
            modified_verses += 1
            if dry_run:
                # Print a preview of the changes
                verse_num = item.get('verse', '?')
                print(f"  Verse {verse_num}:")
                print(f"    - {original_text}")
                print(f"    + {new_text}")
            item['text'] = new_text
            
        modified_data.append(item)
        
    if modified_verses > 0 and not dry_run:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(modified_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error writing file {filepath}: {e}", file=sys.stderr)
            return 0
            
    return modified_verses

def process_directory(root_path: str, dry_run: bool) -> None:
    total_files = 0
    modified_files = 0
    total_modified_verses = 0
    
    for dirpath, _, filenames in os.walk(root_path):
        for filename in sorted(filenames):
            # Skip index.json and other non-json files
            if not filename.endswith('.json') or filename == 'index.json':
                continue
                
            filepath = os.path.join(dirpath, filename)
            total_files += 1
            
            # Print file context if we are in dry run and there are changes, or just process it
            if dry_run:
                # Run the file process (which will print preview changes internally if dry_run=True)
                # Let's print the filename before its changes so we know where they are
                temp_output = []
                # Capturing stdout to only print file header if changes actually exist in that file
                import io
                from contextlib import redirect_stdout
                f_io = io.StringIO()
                with redirect_stdout(f_io):
                    verses_changed = process_file(filepath, dry_run=True)
                output_str = f_io.getvalue()
                if verses_changed > 0:
                    print(f"File: {filepath} ({verses_changed} changes)")
                    print("-" * 60)
                    print(output_str, end="")
                    print("=" * 60)
                    modified_files += 1
                    total_modified_verses += verses_changed
            else:
                verses_changed = process_file(filepath, dry_run=False)
                if verses_changed > 0:
                    modified_files += 1
                    total_modified_verses += verses_changed
                    
    mode_str = " (dry run)" if dry_run else ""
    print(f"\nDone{mode_str}:")
    print(f"  Total JSON files checked : {total_files}")
    print(f"  Files modified           : {modified_files}")
    print(f"  Total verses modified    : {total_modified_verses}")

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clean up Bible texts by removing square brackets and title-casing all-caps first words.",
    )
    parser.add_argument(
        "path",
        nargs="?",
        default="/Users/fabian/Documents/CodeProjects/github.com/xeost/veobible-app/public/bible-data",
        help="Root directory to traverse (defaults to the project's bible-data path).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying the files.",
    )
    args = parser.parse_args()
    
    root = os.path.abspath(args.path)
    if not os.path.isdir(root):
        print(f"Error: '{root}' is not a valid directory.", file=sys.stderr)
        sys.exit(1)
        
    mode_label = " (DRY RUN — no files will be changed)" if args.dry_run else ""
    print(f"Traversing directory: {root}{mode_label}")
    print()
    
    process_directory(root, args.dry_run)

if __name__ == "__main__":
    main()
