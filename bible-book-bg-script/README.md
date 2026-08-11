# Bible Book Background Prompt Generator (Google Flow)

A standalone Python tool for generating customized, cinematic background image prompts for all 66 books of the King James Version (KJV) Bible. Each prompt is automatically formatted and copied to your system clipboard one book at a time, making it effortless to paste directly into **Google Flow** to generate background visuals for Bible book videos.

---

## Features

- **Sequential Clipboard Copying**: Automatically copies each rendered prompt to the clipboard and advances when you press Enter.
- **Complete 66 KJV Books Dataset**: Out of the box, `books-data.json` contains curated theological themes, visual settings, key motifs, lighting styles, and color palettes for all 66 books.
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

1. The script automatically renders and copies the first prompt (**Genesis**) to your clipboard.
2. Switch to **Google Flow** in your browser and paste (`Cmd+V` / `Ctrl+V`) the prompt to generate your 16:9 background image.
3. Return to the terminal and press **`[Enter]`**.
4. The prompt for the next book (**Exodus**) is immediately rendered, displayed, and copied to your clipboard.
5. Repeat through all 66 books until **Revelation**.

---

## Interactive Controls

While running interactively, the following controls are available:

| Command | Action |
| --- | --- |
| `[Enter]` or `n` | Advance to the **next** book and copy its prompt |
| `b` or `p` | Go back to the **previous** book and copy its prompt |
| `r` | **Re-copy** the current book's prompt to the clipboard |
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
  -l, --list            List all 66 books with order numbers and exit
  --dump                Render and print all 66 prompts to stdout without interactive prompts
```

### CLI Examples

```bash
# Start from book #40 (Matthew / New Testament)
python3 generate_prompts.py --start 40

# Start directly at Psalms
python3 generate_prompts.py --book Psalms

# List all 66 books and their order
python3 generate_prompts.py --list

# Dump all 66 prompts to a text file
python3 generate_prompts.py --dump > all_prompts.txt
```

---

## Template Customization & Available Variables

The file `template.txt` defines how each prompt is constructed for Google Flow. You can edit this file to alter style keywords, aspect ratios, or composition rules.

### Default Template

```text
Cinematic background visual for the biblical book of {name} ({testament} - {category}). Theme: {theme}. Setting: {setting}. Key visual elements: {visual_elements}. Mood & atmosphere: {mood}. Lighting: {lighting}. Color palette: {color_palette}. Style: photorealistic cinematic film still, 8k resolution, epic wide shot, atmospheric depth, volumetric light, sacred and reverent tone, clean landscape background for video, 16:9 aspect ratio, highly detailed texture, no text, no modern elements.
```

### Available Template Variables

Any property present in each book object in `books-data.json` can be used as a `{placeholder}`:

| Variable | Description | Example Value |
| --- | --- | --- |
| `{order}` | Sequential book number (1 to 66) | `1` |
| `{id}` | Normalized book slug | `genesis` |
| `{name}` | Full name of the book | `Genesis` |
| `{testament}` | Testament division | `Old Testament` / `New Testament` |
| `{category}` | Literary genre / division | `Pentateuch / Law`, `Gospels`, `Poetry & Wisdom` |
| `{chapters}` | Number of chapters | `50` |
| `{author}` | Traditional biblical author | `Moses`, `David`, `Paul`, `John` |
| `{theme}` | Central theological message & story arc | `Creation, beginnings, fall of humanity, and covenant...` |
| `{setting}` | Historical and geographical landscape | `Ancient Near East, Garden of Eden, Canaan, Egypt` |
| `{visual_elements}` | Visual motifs, scenery, objects | `Primordial creation, rivers of Eden, starry skies...` |
| `{mood}` | Emotional and atmospheric tone | `Sacred, primordial, majestic, reverent` |
| `{lighting}` | Cinematic lighting style | `Ethereal golden dawn rays breaking through mist` |
| `{color_palette}` | Harmonic color scheme | `Cosmic indigo, radiant gold, deep emerald green` |
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
  "setting": "Ancient Near East, Garden of Eden, Mount Ararat, Mesopotamia, Ur of the Chaldees, Canaan, and Egypt",
  "visual_elements": "Primordial creation with light piercing cosmic darkness, fertile rivers of Eden, starry night sky over desert tents of Abraham, stone altars in rugged Canaanite hills, ancient Nile riverbanks of Egypt",
  "mood": "Sacred, primordial, majestic, reverent, mysterious, dawn of existence",
  "lighting": "Ethereal golden dawn rays breaking through cosmic mist, warm amber sunset over desert dunes",
  "color_palette": "Cosmic indigo, radiant gold, deep emerald green, warm terracotta and desert sand",
  "description": "The book of beginnings, narrating the creation of the world, the fall of man, and the origins of the nation of Israel through the patriarchs."
}
```

---

## Tips for Google Flow Background Generation

1. **Aspect Ratio**: Keep `16:9 aspect ratio` in the prompt to match standard video resolution (1920x1080 / 4K).
2. **Negative / Restrictive Prompts**: Including `clean landscape background for video, no text, no modern elements` ensures the generated image leaves ample clean space for chapter titles and scripture text overlays.
3. **Volumetric Lighting**: Keywords like `volumetric light`, `atmospheric depth`, and `cinematic film still` produce rich textures suitable for slow panning and zoom video animations.
