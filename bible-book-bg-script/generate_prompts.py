#!/usr/bin/env python3
"""
Bible Book Background Prompt Generator for Google Flow

This script reads Bible book metadata from `books-data.json`, renders
a customizable prompt template from `template.txt` for each book,
and automatically copies both the prompt and corresponding filename to your clipboard
in a convenient two-step workflow for generating images in Google Flow.

Workflow per book:
    1. Step 1: Prompt is automatically rendered and copied to clipboard.
               -> Paste into Google Flow to generate the image.
               -> Press [ENTER].
    2. Step 2: The exact filename without extension (e.g. '01-genesis') is copied to clipboard.
               -> Paste when saving the generated image file.
               -> Press [ENTER] to advance to the next book.

Usage:
    python3 generate_prompts.py
    python3 generate_prompts.py --start 40
    python3 generate_prompts.py --book Matthew
    python3 generate_prompts.py --list
    python3 generate_prompts.py --dump
"""

import argparse
import json
import os
import platform
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_FILE = SCRIPT_DIR / "books-data.json"
DEFAULT_TEMPLATE_FILE = SCRIPT_DIR / "template.txt"


def copy_to_clipboard(text: str) -> bool:
    """
    Copies text to the system clipboard using pyperclip if installed,
    or native operating system utilities (pbcopy, clip, xclip, wl-copy).
    """
    # Try pyperclip if available
    try:
        import pyperclip  # type: ignore

        pyperclip.copy(text)
        return True
    except ImportError:
        pass

    system = platform.system().lower()

    try:
        if system == "darwin":
            subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=True)
            return True
        elif system == "windows":
            subprocess.run(
                ["clip"],
                input=text.encode("utf-16le"),
                check=True,
                shell=True,
            )
            return True
        elif system == "linux":
            # Check for Wayland (wl-copy) or X11 (xclip/xsel)
            if "WAYLAND_DISPLAY" in os.environ:
                try:
                    subprocess.run(
                        ["wl-copy"], input=text.encode("utf-8"), check=True
                    )
                    return True
                except (subprocess.SubprocessError, FileNotFoundError):
                    pass

            for cmd in [["xclip", "-selection", "clipboard"], ["xsel", "-b", "-i"]]:
                try:
                    subprocess.run(cmd, input=text.encode("utf-8"), check=True)
                    return True
                except (subprocess.SubprocessError, FileNotFoundError):
                    continue

            # Fallback to tkinter if installed
            try:
                import tkinter as tk

                root = tk.Tk()
                root.withdraw()
                root.clipboard_clear()
                root.clipboard_append(text)
                root.update()
                root.destroy()
                return True
            except Exception:
                pass
    except Exception as e:
        print(f"Warning: Failed to copy to clipboard automatically ({e}).", file=sys.stderr)
        return False

    return False


def load_books_data(path: Path) -> List[Dict[str, Any]]:
    """Loads and validates Bible book data from JSON file."""
    if not path.is_file():
        raise FileNotFoundError(f"Books data file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("Expected books data JSON to contain a list of book objects.")

    return data


def load_template(path: Path) -> str:
    """Loads prompt template from text file."""
    if not path.is_file():
        raise FileNotFoundError(f"Template file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def get_book_filename(book: Dict[str, Any], index: int = 0) -> str:
    """
    Returns the formatted filename without extension for the book.
    Structure matches standard audiobibles conventions: e.g. '01-genesis', '09-1-samuel', '40-matthew'.
    """
    order = book.get("order", index + 1)
    book_id = str(book.get("id", "")).strip().lower()
    if not book_id:
        name = str(book.get("name", f"book-{order}")).strip().lower()
        book_id = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
    return f"{int(order):02d}-{book_id}"


def render_prompt(template: str, book: Dict[str, Any], index: int = 0) -> str:
    """
    Renders the template with book properties.
    Placeholders like {name}, {theme}, {filename}, etc. are replaced.
    """
    context = dict(book)
    context["filename"] = get_book_filename(book, index)

    def replacer(match: re.Match) -> str:
        key = match.group(1)
        if key in context:
            return str(context[key])
        return match.group(0)

    # Replace {placeholder} patterns
    rendered = re.sub(r"\{([a-zA-Z0-9_]+)\}", replacer, template)
    # Clean up duplicate spaces and strip whitespace
    rendered = re.sub(r"[ \t]+", " ", rendered).strip()
    return rendered


def find_book_index(books: List[Dict[str, Any]], query: str) -> Optional[int]:
    """Finds 0-based book index by number, id, or case-insensitive name."""
    query_clean = query.strip().lower()

    if query_clean.isdigit():
        num = int(query_clean)
        if 1 <= num <= len(books):
            return num - 1
        return None

    # Search by id or exact name
    for i, book in enumerate(books):
        book_id = str(book.get("id", "")).lower()
        book_name = str(book.get("name", "")).lower()
        if query_clean in (book_id, book_name):
            return i

    # Partial name search
    for i, book in enumerate(books):
        book_name = str(book.get("name", "")).lower()
        if query_clean in book_name:
            return i

    return None


def print_banner() -> None:
    """Prints a clean CLI header banner."""
    print("=" * 78)
    print("  BIBLE BOOK BACKGROUND PROMPT GENERATOR (GOOGLE FLOW)")
    print("=" * 78)


def get_book_header(index: int, total: int, book: Dict[str, Any]) -> str:
    """Returns formatted book header line."""
    name = book.get("name", f"Book #{index + 1}")
    testament = book.get("testament", "")
    category = book.get("category", "")
    chapters = book.get("chapters", "")

    details = []
    if testament:
        details.append(testament)
    if category:
        details.append(category)
    if chapters:
        details.append(f"{chapters} chapters")

    details_str = f" ({' · '.join(details)})" if details else ""
    return f"[Book {index + 1}/{total}] {name.upper()}{details_str}"


def display_prompt_step(
    index: int, total: int, book: Dict[str, Any], prompt: str, filename: str, copied: bool
) -> None:
    """Prints step 1: Rendered prompt to copy into Google Flow."""
    header = get_book_header(index, total, book)

    print("\n" + "-" * 78)
    print(header)
    print(f"Target Filename: {filename}")
    print("-" * 78)
    print("\n[STEP 1/2] Prompt for Google Flow:\n")
    print(f"  {prompt}\n")
    print("-" * 78)

    if copied:
        print("  ✓ [PROMPT COPIED TO CLIPBOARD] Paste into Google Flow to generate image.")
    else:
        print("  ! [NOTE] Could not access clipboard automatically. Please copy the prompt above.")
    print("-" * 78)


def display_filename_step(
    index: int, total: int, book: Dict[str, Any], filename: str, copied: bool
) -> None:
    """Prints step 2: Filename to copy when saving image."""
    header = get_book_header(index, total, book)

    print("\n" + "-" * 78)
    print(header)
    print("-" * 78)
    print("\n[STEP 2/2] Filename for saving image (without extension):\n")
    print(f"  {filename}\n")
    print("-" * 78)

    if copied:
        print(f"  ✓ [FILENAME COPIED TO CLIPBOARD] '{filename}' is ready to paste when saving file.")
    else:
        print("  ! [NOTE] Could not access clipboard automatically. Please copy the filename above.")
    print("-" * 78)


def interactive_loop(
    books: List[Dict[str, Any]], template: str, start_index: int = 0
) -> None:
    """Interactive loop to step through books with 2-step Enter flow."""
    current_index = max(0, min(start_index, len(books) - 1))
    total = len(books)
    current_step = "prompt"  # "prompt" (Step 1) or "filename" (Step 2)

    print_banner()
    print(f"Loaded {total} books from data file.")
    print("Workflow per book:")
    print("  1. [Enter] Copies prompt -> Paste into Google Flow")
    print("  2. [Enter] Copies filename (e.g. '01-genesis') -> Paste when saving image")
    print("  3. [Enter] Moves to next book prompt")
    print("\nNavigation commands at any time:")
    print("  • 'b' / 'p'     : Go back (to prompt of current book, or previous book)")
    print("  • 'r'           : Re-copy current item to clipboard")
    print("  • 'g <#|name>'  : Jump directly to a book (e.g. 'g 40' or 'g Matthew')")
    print("  • 'q'           : Quit")

    while 0 <= current_index < total:
        book = books[current_index]
        filename = get_book_filename(book, current_index)
        prompt = render_prompt(template, book, current_index)

        if current_step == "prompt":
            copied = copy_to_clipboard(prompt)
            display_prompt_step(current_index, total, book, prompt, filename, copied)

            prompt_msg = (
                f"\n[ENTER] -> Copy filename ('{filename}') | "
                "b: back, r: recopy, g <#>: jump, q: quit: "
            )
        else:  # current_step == "filename"
            copied = copy_to_clipboard(filename)
            display_filename_step(current_index, total, book, filename, copied)

            if current_index == total - 1:
                print("\n  🎉 You are on the final book (Revelation)!")
                next_desc = "finish"
            else:
                next_name = books[current_index + 1].get("name", f"Book #{current_index + 2}")
                next_desc = f"Next Book ({next_name})"

            prompt_msg = (
                f"\n[ENTER] -> {next_desc} | "
                "b: back to prompt, r: recopy, g <#>: jump, q: quit: "
            )

        try:
            user_input = input(prompt_msg).strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\nExiting prompt generator. Have a great day!")
            sys.exit(0)

        cmd = user_input.lower()

        # ENTER or NEXT
        if cmd in ("", "n", "next"):
            if current_step == "prompt":
                current_step = "filename"
            else:
                if current_index < total - 1:
                    current_index += 1
                    current_step = "prompt"
                else:
                    print("\nAll 66 Bible book prompts and filenames have been completed!")
                    try:
                        again = input("Restart from beginning? [y/N]: ").strip().lower()
                        if again in ("y", "yes"):
                            current_index = 0
                            current_step = "prompt"
                        else:
                            break
                    except (KeyboardInterrupt, EOFError):
                        break

        # BACK / PREVIOUS
        elif cmd in ("b", "p", "prev", "previous", "back"):
            if current_step == "filename":
                # Go back to Step 1 (prompt) of current book
                current_step = "prompt"
            else:
                # Go back to Step 1 of previous book
                if current_index > 0:
                    current_index -= 1
                    current_step = "prompt"
                else:
                    print("\nAlready at the first book (Genesis).")

        # RE-COPY
        elif cmd in ("r", "recopy", "copy", "reload"):
            # Simply repeat current step and re-copy
            continue

        # QUIT
        elif cmd in ("q", "quit", "exit"):
            print("\nExiting prompt generator. Goodbye!")
            sys.exit(0)

        # JUMP TO BOOK NUMBER OR NAME
        elif cmd.startswith("g ") or cmd.startswith("goto ") or cmd.isdigit():
            query = cmd.split(maxsplit=1)[-1] if not cmd.isdigit() else cmd
            idx = find_book_index(books, query)
            if idx is not None:
                current_index = idx
                current_step = "prompt"
            else:
                print(
                    f"\nCould not find book matching '{query}'. "
                    f"Please enter a valid number (1-{total}) or book name."
                )

        else:
            # Check if user typed a book name directly
            idx = find_book_index(books, user_input)
            if idx is not None:
                current_index = idx
                current_step = "prompt"
            else:
                print(
                    f"\nUnrecognized command '{user_input}'. "
                    "Press Enter to continue, 'b' for back, 'r' for recopy, or 'q' to quit."
                )


def list_books(books: List[Dict[str, Any]]) -> None:
    """Lists all available books in order with their target filenames."""
    print("=" * 88)
    print("  KJV BIBLE BOOKS LIST & FILENAMES")
    print("=" * 88)
    for i, book in enumerate(books):
        name = book.get("name", "Unknown")
        filename = get_book_filename(book, i)
        testament = book.get("testament", "")
        category = book.get("category", "")
        chapters = book.get("chapters", "")
        print(f"  {i + 1:2d}. {name:<20} | {filename:<20} | {testament:<14} | {category:<20} | {chapters} ch")
    print("=" * 88)


def dump_all_prompts(books: List[Dict[str, Any]], template: str) -> None:
    """Outputs all rendered prompts and filenames sequentially."""
    for i, book in enumerate(books):
        name = book.get("name", f"Book #{i + 1}")
        filename = get_book_filename(book, i)
        prompt = render_prompt(template, book, i)
        print(f"=== [{i + 1:02d}] {name} ===")
        print(f"Filename: {filename}")
        print(f"Prompt:\n{prompt}")
        print()


def main() -> None:
    """Main entrypoint for CLI."""
    parser = argparse.ArgumentParser(
        description="Bible Book Background Prompt Generator for Google Flow",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 generate_prompts.py               # Start interactive 2-step prompt & filename copier
  python3 generate_prompts.py --start 40    # Start at Matthew (book 40)
  python3 generate_prompts.py --book Psalms # Start directly at Psalms
  python3 generate_prompts.py --list        # List all 66 books and their filenames
  python3 generate_prompts.py --dump        # Print all rendered prompts and filenames
        """,
    )

    parser.add_argument(
        "-d",
        "--data",
        type=Path,
        default=DEFAULT_DATA_FILE,
        help="Path to books-data.json (default: books-data.json)",
    )
    parser.add_argument(
        "-t",
        "--template",
        type=Path,
        default=DEFAULT_TEMPLATE_FILE,
        help="Path to template.txt (default: template.txt)",
    )
    parser.add_argument(
        "-s",
        "--start",
        type=int,
        default=1,
        help="Starting book number (1-66, default: 1)",
    )
    parser.add_argument(
        "-b",
        "--book",
        type=str,
        default=None,
        help="Start at a specific book by name or id (e.g. 'Genesis', 'Matthew', 'john')",
    )
    parser.add_argument(
        "-l",
        "--list",
        action="store_true",
        help="List all books with their index, filename, and info, then exit",
    )
    parser.add_argument(
        "--dump",
        action="store_true",
        help="Render and print all 66 prompts and filenames to stdout without interactive prompts",
    )

    args = parser.parse_args()

    # Load data and template
    try:
        books = load_books_data(args.data)
        template = load_template(args.template)
    except Exception as e:
        print(f"Error initializing prompt generator: {e}", file=sys.stderr)
        sys.exit(1)

    if args.list:
        list_books(books)
        return

    if args.dump:
        dump_all_prompts(books, template)
        return

    # Determine start index
    start_index = 0
    if args.book:
        found_idx = find_book_index(books, args.book)
        if found_idx is not None:
            start_index = found_idx
        else:
            print(f"Warning: Book '{args.book}' not found. Starting from book 1.", file=sys.stderr)
    elif args.start:
        start_index = max(0, min(args.start - 1, len(books) - 1))

    interactive_loop(books, template, start_index)


if __name__ == "__main__":
    main()
