# Bible Book Background Prompt Generator (Google Flow)

A standalone Python tool for generating customized, cinematic background image prompts for all 66 books of the King James Version (KJV) Bible. Each prompt and filename is automatically formatted and copied to your system clipboard in a two-step Enter workflow, making it effortless to generate and save images in **Google Flow** for Bible book podcast videos.

---

## Features

- **2-Step Clipboard Copy Workflow**:
  - **Step 1**: Copies the rendered prompt for the book to the clipboard -> Paste into Google Flow.
  - **Step 2 (1st [Enter])**: Copies the standardized filename without extension (e.g. `01-genesis`, `40-matthew`) to the clipboard -> Paste when saving the image file.
  - **Step 3 (2nd [Enter])**: Advances to the next book prompt.
- **Consistent File Naming**: Filenames match the standard format `01-genesis`, `02-exodus`, ..., `66-revelation`.
- **Complete 66 KJV Books Dataset**: Out of the box, `books-data.json` contains curated theological themes, visual settings, key motifs, lighting styles, and color palettes for all 66 books.
- **Documentary & Historical Realism**: Optimized to produce dignified, grounded, realistic background imagery without fantasy tropes or uncanny faces.
- **Customizable Template System**: Easily modify `template.txt` using dynamic `{variable}` placeholders.
- **Interactive CLI Controls**: Jump to specific books, go back, re-copy, or list all books at any time.
- **Zero External Dependencies**: Works out-of-the-box using standard Python 3 and native OS clipboard tools (`pbcopy` on macOS, `clip` on Windows, `wl-copy`/`xclip` on Linux), with optional `pyperclip` support.
- **Standalone**: Completely independent from the rest of the repository.

---

## File Structure

```text
bible-book-bg-script/
├── books-data.json       # Metadata for all 66 KJV books
├── generate_prompts.py   # Main prompt generator script
├── main.py               # Quick alias entrypoint
├── template.txt          # Prompt template for Google Flow
└── README.md             # Documentation
```

---

## Quick Start

### 1. Run the script

From the `bible-book-bg-script` directory (or from the project root):

```bash
cd bible-book-bg-script
python3 generate_prompts.py
```

*(You can also use `python3 main.py`)*

### 2. Workflow with Google Flow

1. **Step 1 (Prompt)**: The script automatically renders and copies the first prompt (**Genesis**) to your clipboard.
2. In **Google Flow**, paste (`Cmd+V` / `Ctrl+V`) the prompt and generate the image.
3. Return to the terminal and press **`[Enter]`**.
4. **Step 2 (Filename)**: The script copies the filename (**`01-genesis`**) to your clipboard.
5. In your browser or file dialog, paste the filename when saving the generated image.
6. Press **`[Enter]`** again to advance to the next book (**Exodus** prompt copied to clipboard).
7. Repeat through all 66 books until **Revelation**.

---

## Interactive Controls

While running interactively, the following controls are available:

| Command | Action |
| --- | --- |
| `[Enter]` or `n` | **Step 1 -> Step 2**: Copy filename<br>**Step 2 -> Next Book**: Copy next book prompt |
| `b` or `p` | Go back (from filename back to prompt, or back to previous book) |
| `r` | **Re-copy** current item (prompt or filename) to clipboard |
| `g <number>` or `<number>` | **Jump** directly to a book number (e.g. `g 40` or `40` for Matthew) |
| `g <name>` | **Jump** directly to a book by name (e.g. `g Psalms` or `g Revelation`) |
| `q` or `exit` | **Quit** the program |

---

## Command-Line Options

```text
usage: generate_prompts.py [-h] [-d DATA] [-t TEMPLATE] [-s START] [-b BOOK] [-l] [--dump]

Options:
  -h, --help            Show this help message and exit
  -d, --data DATA       Path to books JSON file (default: books-data.json)
  -t, --template PATH   Path to template file (default: template.txt)
  -s, --start NUMBER    Starting book number (1-66, default: 1)
  -b, --book NAME       Start at a specific book name (e.g. 'Matthew', 'Psalms')
  -l, --list            List all 66 books with filenames and exit
  --dump                Render and print all 66 prompts and filenames to stdout without interactive prompts
```

### CLI Examples

```bash
# Start from book #40 (Matthew / New Testament)
python3 generate_prompts.py --start 40

# Start directly at Psalms
python3 generate_prompts.py --book Psalms

# List all 66 books with their target filenames
python3 generate_prompts.py --list

# Dump all 66 prompts and filenames to a text file
python3 generate_prompts.py --dump > all_prompts.txt
```

---

## Template Customization & Available Variables

The file `template.txt` defines how each prompt is constructed for Google Flow. You can edit this file to alter style keywords, aspect ratios, or composition rules.

### Current Template

```text
Realistic cinematic documentary photography. Subject: {visual_elements}. Environment: {setting}, ancient Middle Eastern landscape. Lighting: {lighting}, soft diffused natural sunlight. Color palette: {color_palette}, muted earth tones, matte finish, organic textures. Composition: horizontal 16:9 aspect ratio, minimalist, ample empty negative space for text overlays, shallow depth of field, soft focus background, subtle film grain. Atmosphere: {mood}, reflective, {theme}. Strictly avoid: fantasy, magic, supernatural glows, dramatic god rays, 3D renders, legible text or writing, close-up human faces or crowds, glossy or plastic textures, anachronisms, modern elements.
```

### Available Template Variables

Any property present in each book object in `books-data.json` can be used as a `{placeholder}`:

| Variable | Description | Example Value |
| --- | --- | --- |
| `{order}` | Sequential book number (1 to 66) | `1` |
| `{id}` | Normalized book slug | `genesis` |
| `{filename}` | Standardized filename without extension | `01-genesis` |
| `{name}` | Full name of the book | `Genesis` |
| `{testament}` | Testament division | `Old Testament` / `New Testament` |
| `{category}` | Literary genre / division | `Pentateuch / Law`, `Gospels`, `Poetry & Wisdom` |
| `{chapters}` | Number of chapters | `50` |
| `{author}` | Traditional biblical author | `Moses`, `David`, `Paul`, `John` |
| `{theme}` | Central theological message & story arc | `Creation, beginnings, fall of humanity, and covenant...` |
| `{setting}` | Historical and geographical landscape | `Ancient Near East, Mount Ararat, Canaan, Egypt` |
| `{visual_elements}` | Visual motifs, scenery, objects | `Vast untouched desert landscape, ancient stone well...` |
| `{mood}` | Emotional and atmospheric tone | `Serene, contemplative, historical, foundational` |
| `{lighting}` | Cinematic lighting style | `Soft natural starlight, diffused golden hour sunlight` |
| `{color_palette}` | Harmonic color scheme | `Muted earth tones, sandstone beige, warm terracotta` |
| `{description}` | Concise book summary | `The book of beginnings, narrating the creation...` |

---

## `books-data.json` Structure

`books-data.json` contains an array of 66 JSON objects. You can freely edit or add extra custom fields (e.g. `"focal_point"`, `"camera_angle"`, etc.) and immediately use them in `template.txt`.

Example entry:

```json
{
  "order": 1,
  "id": "genesis",
  "name": "Genesis",
  "testament": "Old Testament",
  "category": "Pentateuch / Law",
  "chapters": 50,
  "author": "Moses",
  "theme": "Creation, beginnings, fall of humanity, and God's covenant with Abraham, Isaac, and Jacob",
  "setting": "Ancient Near East, Mount Ararat, Mesopotamia, Ur of the Chaldees, Canaan, and Egypt",
  "visual_elements": "Vast untouched desert landscape, ancient stone well, nomadic tents in the distant horizon, starry night sky",
  "mood": "Serene, contemplative, historical, foundational, quiet",
  "lighting": "Soft natural starlight, diffused golden hour sunlight over sand dunes",
  "color_palette": "Muted earth tones, sandstone beige, warm terracotta, deep indigo, olive drab",
  "description": "The book of beginnings, narrating the creation of the world, the fall of man, and the origins of the nation of Israel through the patriarchs."
}
```
