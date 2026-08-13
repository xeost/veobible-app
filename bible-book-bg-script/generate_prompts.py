#!/usr/bin/env python3
"""
Bible Book Prompt Generator for Google Flow

This script generates prompts for all 66 books of the Bible with 4 operation modes:
  1. Background Image Prompts (Cinematic 16:9, completely without text)
  2. Add English Title to Attached Image (KJV Name - e.g. "GENESIS")
  3. Add Spanish Title to Attached Image (Reina Valera Name - e.g. "GÉNESIS")
  4. Add Portuguese Title to Attached Image (ARC Name - e.g. "GÊNESIS")

Workflow per book:
    1. Step 1: Prompt is automatically rendered and copied to clipboard.
               -> Paste into Google Flow to generate or edit the image.
               -> Press [ENTER].
    2. Step 2: The exact filename without extension (e.g. '01-genesis') is copied to clipboard.
               -> Paste when saving the generated image file.
               -> Press [ENTER] to advance to the next book.

Usage:
    python3 generate_prompts.py
    python3 generate_prompts.py --mode 3
    python3 generate_prompts.py --mode es --start 40
    python3 generate_prompts.py --book Matthew
    python3 generate_prompts.py --list
    python3 generate_prompts.py --dump --mode pt
"""

import argparse
import json
import os
import platform
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_FILE = SCRIPT_DIR / "books-data.json"
DEFAULT_BG_TEMPLATE_FILE = SCRIPT_DIR / "template_bg.txt"
LEGACY_TEMPLATE_FILE = SCRIPT_DIR / "template.txt"
DEFAULT_TITLE_TEMPLATE_FILE = SCRIPT_DIR / "template_title.txt"

MODES: Dict[str, Dict[str, Any]] = {
    "1": {
        "key": "bg",
        "name": "Background Image Prompts (Cinematic 16:9, completely without text)",
        "short_name": "Background (No Text)",
        "default_template": DEFAULT_BG_TEMPLATE_FILE,
        "fallback_template": LEGACY_TEMPLATE_FILE,
        "lang_code": "en",
        "language": "N/A",
        "title_field": None,
    },
    "2": {
        "key": "title-en",
        "name": "Add English Title to Attached Image (KJV Name - e.g. \"GENESIS\")",
        "short_name": "English Title (KJV)",
        "default_template": DEFAULT_TITLE_TEMPLATE_FILE,
        "fallback_template": DEFAULT_TITLE_TEMPLATE_FILE,
        "lang_code": "en",
        "language": "English",
        "title_field": "name",
    },
    "3": {
        "key": "title-es",
        "name": "Add Spanish Title to Attached Image (Reina Valera Name - e.g. \"GÉNESIS\")",
        "short_name": "Spanish Title (Reina Valera)",
        "default_template": DEFAULT_TITLE_TEMPLATE_FILE,
        "fallback_template": DEFAULT_TITLE_TEMPLATE_FILE,
        "lang_code": "es",
        "language": "Spanish",
        "title_field": "name_es",
    },
    "4": {
        "key": "title-pt",
        "name": "Add Portuguese Title to Attached Image (ARC Name - e.g. \"GÊNESIS\")",
        "short_name": "Portuguese Title (ARC)",
        "default_template": DEFAULT_TITLE_TEMPLATE_FILE,
        "fallback_template": DEFAULT_TITLE_TEMPLATE_FILE,
        "lang_code": "pt",
        "language": "Portuguese",
        "title_field": "name_pt",
    },
}

MODE_ALIASES: Dict[str, str] = {
    "1": "1",
    "bg": "1",
    "background": "1",
    "2": "2",
    "en": "2",
    "english": "2",
    "kjv": "2",
    "title-en": "2",
    "3": "3",
    "es": "3",
    "spanish": "3",
    "español": "3",
    "rv": "3",
    "reina-valera": "3",
    "title-es": "3",
    "4": "4",
    "pt": "4",
    "portuguese": "4",
    "português": "4",
    "arc": "4",
    "title-pt": "4",
}


def resolve_mode(value: Optional[str]) -> Optional[str]:
    """Resolves mode string/alias to canonical mode key ('1', '2', '3', '4')."""
    if not value:
        return None
    cleaned = value.strip().lower()
    return MODE_ALIASES.get(cleaned)


def copy_to_clipboard(text: str) -> bool:
    """
    Copies text to the system clipboard using pyperclip if installed,
    or native operating system utilities (pbcopy, clip, xclip, wl-copy).
    """
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


def load_template(path: Path, fallback_path: Optional[Path] = None) -> str:
    """Loads prompt template from text file with optional fallback."""
    target = path if path.is_file() else (fallback_path if fallback_path and fallback_path.is_file() else None)
    if not target or not target.is_file():
        raise FileNotFoundError(f"Template file not found at: {path} (or fallback: {fallback_path})")

    with open(target, "r", encoding="utf-8") as f:
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


def get_book_title(book: Dict[str, Any], mode_config: Dict[str, Any]) -> str:
    """Gets the localized or default book title for the selected mode."""
    field = mode_config.get("title_field")
    if field:
        title = book.get(field)
        if title:
            return str(title).strip()
    return str(book.get("name", "")).strip()


def render_prompt(
    template: str,
    book: Dict[str, Any],
    mode_config: Dict[str, Any],
    index: int = 0,
) -> str:
    """
    Renders the template with book properties and mode-specific variables.
    Placeholders like {title}, {title_upper}, {language}, {name}, {theme}, {filename}, etc. are replaced.
    """
    context = dict(book)
    context["filename"] = get_book_filename(book, index)
    
    title = get_book_title(book, mode_config)
    context["title"] = title
    context["title_upper"] = title.upper()
    context["language"] = mode_config.get("language", "English")
    context["lang"] = mode_config.get("lang_code", "en")
    context["name_en"] = str(book.get("name", "")).strip()
    context["name_es"] = str(book.get("name_es", book.get("name", ""))).strip()
    context["name_pt"] = str(book.get("name_pt", book.get("name", ""))).strip()

    def replacer(match: re.Match) -> str:
        key = match.group(1)
        if key in context:
            return str(context[key])
        return match.group(0)

    rendered = re.sub(r"\{([a-zA-Z0-9_]+)\}", replacer, template)
    rendered = re.sub(r"[ \t]+", " ", rendered).strip()
    return rendered


def find_book_index(books: List[Dict[str, Any]], query: str) -> Optional[int]:
    """Finds 0-based book index by number, id, or case-insensitive name in any supported language."""
    query_clean = query.strip().lower()

    if query_clean.isdigit():
        num = int(query_clean)
        if 1 <= num <= len(books):
            return num - 1
        return None

    # Search by exact id, English name, Spanish name, or Portuguese name
    for i, book in enumerate(books):
        book_id = str(book.get("id", "")).lower()
        name_en = str(book.get("name", "")).lower()
        name_es = str(book.get("name_es", "")).lower()
        name_pt = str(book.get("name_pt", "")).lower()
        if query_clean in (book_id, name_en, name_es, name_pt):
            return i

    # Partial name search
    for i, book in enumerate(books):
        name_en = str(book.get("name", "")).lower()
        name_es = str(book.get("name_es", "")).lower()
        name_pt = str(book.get("name_pt", "")).lower()
        if query_clean in name_en or query_clean in name_es or query_clean in name_pt:
            return i

    return None


def print_banner(mode_config: Optional[Dict[str, Any]] = None) -> None:
    """Prints a clean CLI header banner."""
    print("=" * 82)
    print("  BIBLE BOOK PROMPT GENERATOR FOR GOOGLE FLOW")
    if mode_config:
        print(f"  MODE: {mode_config['short_name'].upper()}")
    print("=" * 82)


def select_mode_interactive() -> str:
    """Displays interactive mode selection menu and returns chosen mode key ('1'-'4')."""
    print("=" * 82)
    print("  BIBLE BOOK PROMPT GENERATOR FOR GOOGLE FLOW")
    print("=" * 82)
    print("Select an option:\n")
    print("  [1] Background Image Prompts (Cinematic 16:9, completely without text)")
    print("  [2] Add English Title to Attached Image (KJV Name - e.g. \"GENESIS\")")
    print("  [3] Add Spanish Title to Attached Image (Reina Valera Name - e.g. \"GÉNESIS\")")
    print("  [4] Add Portuguese Title to Attached Image (ARC Name - e.g. \"GÊNESIS\")\n")

    while True:
        try:
            choice = input("Enter option [1-4] (default: 1): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            sys.exit(0)

        if not choice:
            return "1"

        resolved = resolve_mode(choice)
        if resolved:
            return resolved

        print("Invalid choice. Please enter 1, 2, 3, or 4.")


def get_book_header(
    index: int, total: int, book: Dict[str, Any], mode_config: Dict[str, Any]
) -> str:
    """Returns formatted book header line."""
    name_kjv = book.get("name", f"Book #{index + 1}")
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

    if mode_config["key"] != "bg":
        title_lang = mode_config["language"]
        target_title = get_book_title(book, mode_config)
        return (
            f"[Book {index + 1}/{total}] {name_kjv} · "
            f"Title [{title_lang}]: \"{target_title.upper()}\"{details_str}"
        )

    return f"[Book {index + 1}/{total}] {name_kjv.upper()}{details_str}"


def display_prompt_step(
    index: int,
    total: int,
    book: Dict[str, Any],
    prompt: str,
    filename: str,
    mode_config: Dict[str, Any],
    copied: bool,
) -> None:
    """Prints step 1: Rendered prompt to copy into Google Flow."""
    header = get_book_header(index, total, book, mode_config)

    print("\n" + "-" * 82)
    print(header)
    print(f"Mode: {mode_config['name']}")
    print(f"Target Filename: {filename}")
    print("-" * 82)
    print("\n[STEP 1/2] Prompt for Google Flow (in English):\n")
    print(f"  {prompt}\n")
    print("-" * 82)

    if copied:
        print("  ✓ [PROMPT COPIED TO CLIPBOARD] Paste into Google Flow.")
    else:
        print("  ! [NOTE] Could not access clipboard automatically. Please copy the prompt above.")
    print("-" * 82)


def display_filename_step(
    index: int,
    total: int,
    book: Dict[str, Any],
    filename: str,
    mode_config: Dict[str, Any],
    copied: bool,
) -> None:
    """Prints step 2: Filename to copy when saving image."""
    header = get_book_header(index, total, book, mode_config)

    print("\n" + "-" * 82)
    print(header)
    print("-" * 82)
    print("\n[STEP 2/2] Filename for saving image (without extension):\n")
    print(f"  {filename}\n")
    print("-" * 82)

    if copied:
        print(f"  ✓ [FILENAME COPIED TO CLIPBOARD] '{filename}' is ready to paste when saving file.")
    else:
        print("  ! [NOTE] Could not access clipboard automatically. Please copy the filename above.")
    print("-" * 82)


def interactive_loop(
    books: List[Dict[str, Any]],
    mode_key: str,
    template: str,
    start_index: int = 0,
    single_step: bool = False,
) -> None:
    """Interactive loop to step through books with 2-step (or single-step) Enter flow."""
    current_index = max(0, min(start_index, len(books) - 1))
    total = len(books)
    current_step = "prompt"
    current_mode_key = mode_key
    current_template = template

    mode_config = MODES[current_mode_key]

    print_banner(mode_config)
    print(f"Loaded {total} books from data file.")
    print("Workflow per book:")
    if single_step:
        print("  1. [Enter] Copies prompt & advances directly to next book")
    else:
        print("  1. [Enter] Copies prompt -> Paste into Google Flow")
        print("  2. [Enter] Copies filename (e.g. '01-genesis') -> Paste when saving image")
        print("  3. [Enter] Moves to next book prompt")
    print("\nNavigation commands at any time:")
    print("  • 'b' / 'p'     : Go back (to prompt of current book, or previous book)")
    print("  • 'f'           : Copy filename to clipboard directly")
    print("  • 'r'           : Re-copy current item to clipboard")
    print("  • 'm'           : Switch operation mode (1-4)")
    print("  • 'g <#|name>'  : Jump directly to a book (e.g. 'g 40' or 'g Matthew' or 'g Mateo')")
    print("  • 'q'           : Quit")

    while 0 <= current_index < total:
        mode_config = MODES[current_mode_key]
        book = books[current_index]
        filename = get_book_filename(book, current_index)
        prompt = render_prompt(current_template, book, mode_config, current_index)

        if single_step:
            copied = copy_to_clipboard(prompt)
            display_prompt_step(current_index, total, book, prompt, filename, mode_config, copied)

            if current_index == total - 1:
                print("\n  🎉 You are on the final book (Revelation)!")
                next_desc = "finish"
            else:
                next_name = books[current_index + 1].get("name", f"Book #{current_index + 2}")
                next_desc = f"Next Book ({next_name})"

            prompt_msg = (
                f"\n[ENTER] -> {next_desc} | "
                "f: copy filename, b: back, r: recopy, m: mode, g <#>: jump, q: quit: "
            )
        else:
            if current_step == "prompt":
                copied = copy_to_clipboard(prompt)
                display_prompt_step(current_index, total, book, prompt, filename, mode_config, copied)
                prompt_msg = (
                    f"\n[ENTER] -> Copy filename ('{filename}') | "
                    "b: back, r: recopy, m: mode, g <#>: jump, q: quit: "
                )
            else:  # current_step == "filename"
                copied = copy_to_clipboard(filename)
                display_filename_step(current_index, total, book, filename, mode_config, copied)

                if current_index == total - 1:
                    print("\n  🎉 You are on the final book (Revelation)!")
                    next_desc = "finish"
                else:
                    next_name = books[current_index + 1].get("name", f"Book #{current_index + 2}")
                    next_desc = f"Next Book ({next_name})"

                prompt_msg = (
                    f"\n[ENTER] -> {next_desc} | "
                    "b: back to prompt, r: recopy, m: mode, g <#>: jump, q: quit: "
                )

        try:
            user_input = input(prompt_msg).strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\nExiting prompt generator. Have a great day!")
            sys.exit(0)

        cmd = user_input.lower()

        # ENTER or NEXT
        if cmd in ("", "n", "next"):
            if single_step:
                if current_index < total - 1:
                    current_index += 1
                else:
                    print("\nAll 66 Bible book prompts completed!")
                    try:
                        again = input("Restart from beginning? [y/N]: ").strip().lower()
                        if again in ("y", "yes"):
                            current_index = 0
                        else:
                            break
                    except (KeyboardInterrupt, EOFError):
                        break
            else:
                if current_step == "prompt":
                    current_step = "filename"
                else:
                    if current_index < total - 1:
                        current_index += 1
                        current_step = "prompt"
                    else:
                        print("\nAll 66 Bible book prompts and filenames completed!")
                        try:
                            again = input("Restart from beginning? [y/N]: ").strip().lower()
                            if again in ("y", "yes"):
                                current_index = 0
                                current_step = "prompt"
                            else:
                                break
                        except (KeyboardInterrupt, EOFError):
                            break

        # COPY FILENAME EXPLICITLY
        elif cmd in ("f", "fn", "filename"):
            copied = copy_to_clipboard(filename)
            if copied:
                print(f"\n  ✓ [FILENAME COPIED] '{filename}' copied to clipboard.")
            else:
                print(f"\n  Filename: {filename}")

        # CHANGE MODE
        elif cmd in ("m", "mode"):
            new_mode_key = select_mode_interactive()
            if new_mode_key != current_mode_key:
                current_mode_key = new_mode_key
                new_cfg = MODES[current_mode_key]
                current_template = load_template(
                    new_cfg["default_template"], new_cfg.get("fallback_template")
                )
                current_step = "prompt"
                print(f"\nSwitched to Mode {current_mode_key}: {new_cfg['name']}\n")

        # BACK / PREVIOUS
        elif cmd in ("b", "p", "prev", "previous", "back"):
            if not single_step and current_step == "filename":
                current_step = "prompt"
            else:
                if current_index > 0:
                    current_index -= 1
                    current_step = "prompt"
                else:
                    print("\nAlready at the first book (Genesis).")

        # RE-COPY
        elif cmd in ("r", "recopy", "copy", "reload"):
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
            idx = find_book_index(books, user_input)
            if idx is not None:
                current_index = idx
                current_step = "prompt"
            else:
                print(
                    f"\nUnrecognized command '{user_input}'. "
                    "Press Enter to continue, 'b' for back, 'f' for filename, 'm' to change mode, or 'q' to quit."
                )


def list_books(books: List[Dict[str, Any]]) -> None:
    """Lists all available books in order with their multilingual names and target filenames."""
    print("=" * 96)
    print("  BIBLE BOOKS LIST (ENGLISH / SPANISH / PORTUGUESE) & FILENAMES")
    print("=" * 96)
    header = f"  {'#':<3} {'English (KJV)':<18} | {'Spanish (RV)':<18} | {'Portuguese (ARC)':<20} | {'Filename':<18} | {'Chapters':<8}"
    print(header)
    print("-" * 96)
    for i, book in enumerate(books):
        name_en = book.get("name", "Unknown")
        name_es = book.get("name_es", "-")
        name_pt = book.get("name_pt", "-")
        filename = get_book_filename(book, i)
        chapters = book.get("chapters", "")
        print(
            f"  {i + 1:2d}. {name_en:<18} | {name_es:<18} | {name_pt:<20} | {filename:<18} | {chapters} ch"
        )
    print("=" * 96)


def dump_all_prompts(
    books: List[Dict[str, Any]], template: str, mode_config: Dict[str, Any]
) -> None:
    """Outputs all rendered prompts and filenames sequentially for the chosen mode."""
    print(f"# Prompts Dump - Mode: {mode_config['name']}\n")
    for i, book in enumerate(books):
        name = book.get("name", f"Book #{i + 1}")
        target_title = get_book_title(book, mode_config)
        filename = get_book_filename(book, i)
        prompt = render_prompt(template, book, mode_config, i)
        print(f"=== [{i + 1:02d}] {name} (Title: {target_title.upper()}) ===")
        print(f"Filename: {filename}")
        print(f"Prompt:\n{prompt}")
        print()


def main() -> None:
    """Main entrypoint for CLI."""
    parser = argparse.ArgumentParser(
        description="Bible Book Prompt Generator for Google Flow (Backgrounds & Title Overlays)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Modes:
  1, bg          Background Image Prompts (Cinematic 16:9, completely without text)
  2, en, title-en Add English Title to Attached Image (KJV Name - e.g. "GENESIS")
  3, es, title-es Add Spanish Title to Attached Image (Reina Valera Name - e.g. "GÉNESIS")
  4, pt, title-pt Add Portuguese Title to Attached Image (ARC Name - e.g. "GÊNESIS")

Examples:
  python3 generate_prompts.py               # Interactive mode selection & prompt copier
  python3 generate_prompts.py --mode 3      # Start directly with Spanish titles (Reina Valera)
  python3 generate_prompts.py --mode pt -s 40 # Start at Matthew in Portuguese
  python3 generate_prompts.py --book Psalms # Start directly at Psalms
  python3 generate_prompts.py --list        # List all 66 books in EN / ES / PT
  python3 generate_prompts.py --dump -m es  # Dump all 66 Spanish title prompts to stdout
        """,
    )

    parser.add_argument(
        "-m",
        "--mode",
        type=str,
        default=None,
        help="Operation mode: 1 (bg), 2 (title-en), 3 (title-es), 4 (title-pt)",
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
        default=None,
        help="Custom template file path (overrides default template for the selected mode)",
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
        help="Start at a specific book by name or id (e.g. 'Genesis', 'Mateo', 'João', 'matthew')",
    )
    parser.add_argument(
        "-l",
        "--list",
        action="store_true",
        help="List all books with English, Spanish, Portuguese names and filenames, then exit",
    )
    parser.add_argument(
        "--dump",
        action="store_true",
        help="Render and print all 66 prompts and filenames to stdout without interactive prompts",
    )
    parser.add_argument(
        "--single-step",
        "--fast",
        action="store_true",
        help="Advance directly to the next book on Enter without the secondary filename step",
    )

    args = parser.parse_args()

    # Load data
    try:
        books = load_books_data(args.data)
    except Exception as e:
        print(f"Error loading books data: {e}", file=sys.stderr)
        sys.exit(1)

    if args.list:
        list_books(books)
        return

    # Determine mode
    resolved_mode = resolve_mode(args.mode)
    if not resolved_mode and not args.dump:
        resolved_mode = select_mode_interactive()
    elif not resolved_mode:
        resolved_mode = "1"

    mode_config = MODES[resolved_mode]

    # Determine template
    template_path = args.template if args.template else mode_config["default_template"]
    fallback_template_path = mode_config.get("fallback_template")

    try:
        template = load_template(template_path, fallback_template_path)
    except Exception as e:
        print(f"Error loading template: {e}", file=sys.stderr)
        sys.exit(1)

    if args.dump:
        dump_all_prompts(books, template, mode_config)
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

    interactive_loop(
        books=books,
        mode_key=resolved_mode,
        template=template,
        start_index=start_index,
        single_step=args.single_step,
    )


if __name__ == "__main__":
    main()
