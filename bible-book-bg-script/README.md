# Bible Book Prompt Generator (Google Flow)

A standalone Python tool for generating customized prompts for all 66 books of the Bible, designed for use in **Google Flow** (Nano / Imagen). It supports both **background generation** and **multilingual title overlays** (English KJV, Spanish Reina Valera, Portuguese ARC).

Each prompt and filename is automatically formatted and copied to your system clipboard in a seamless step-by-step workflow.

---

## 4 Operation Modes

When starting the tool, you can select from 4 modes:

1. **Option 1: Background Images (No Text)**
   - Generates cinematic, documentary-style 16:9 background landscape prompts with empty negative space, strictly without text or writing.
2. **Option 2: Add English Title (KJV)**
   - Generates prompts in English instructing Google Flow to overlay the English book title (e.g. `"GENESIS"`, `"MATTHEW"`, `"REVELATION"`) onto an attached background image.
3. **Option 3: Add Spanish Title (Reina Valera)**
   - Generates prompts in English instructing Google Flow to overlay the Spanish Reina Valera title (e.g. `"GÉNESIS"`, `"MATEO"`, `"APOCALIPSIS"`). Explicitly enforces non-translation to keep the Spanish spelling and accents.
4. **Option 4: Add Portuguese Title (ARC)**
   - Generates prompts in English instructing Google Flow to overlay the Portuguese Almeida Revista e Corrigida title (e.g. `"GÊNESIS"`, `"MATEUS"`, `"CÂNTICO DOS CÂNTICOS"`). Explicitly enforces non-translation to keep Portuguese accents and orthography.

---

## Features

- **2-Step Clipboard Copy Workflow**:
  - **Step 1**: Copies the rendered prompt for the book to the clipboard -> Paste into Google Flow.
  - **Step 2 (1st [Enter])**: Copies the standardized filename without extension (e.g. `01-genesis`, `40-matthew`) to the clipboard -> Paste when saving the image file.
  - **Step 3 (2nd [Enter])**: Advances to the next book prompt.
- **Consistent Visual Design Line for Titles**:
  - Monumental, classical Roman serif typeface (Trajan / Cinzel aesthetic).
  - Prominent, large, bold uppercase text with balanced letter spacing.
  - Warm limestone cream / antique gold tone with natural ambient soft drop shadow.
  - Razor-sharp edges, high contrast, seamlessly integrated with the background.
- **Anti-Translation Safeguards**:
  - Google Flow AI models can sometimes translate foreign titles into English. Prompts in modes 3 and 4 include strict anti-translation directives to preserve exact Spanish/Portuguese characters and accents.
- **Multilingual 66 Books Dataset**:
  - `books-data.json` contains `name` (English KJV), `name_es` (Spanish Reina Valera), and `name_pt` (Portuguese ARC) along with curated theological themes, visual settings, lighting styles, and color palettes.
- **Interactive CLI Controls**:
  - Jump to specific books by number or name (in English, Spanish, or Portuguese).
  - Switch operation modes on the fly (`m`).
  - Go back, re-copy, or copy filenames at any point.
- **Zero External Dependencies**: Works out-of-the-box using standard Python 3.

---

## File Structure

```text
bible-book-bg-script/
├── books-data.json       # Metadata & multilingual names for all 66 books
├── generate_prompts.py   # Main CLI prompt generator script
├── main.py               # Quick alias entrypoint
├── template_bg.txt       # Background image prompt template (16:9, no text)
├── template_title.txt    # Title addition prompt template (typography & layout)
├── template.txt          # Legacy background template alias
└── README.md             # Documentation
```

---

## Quick Start

### 1. Run the script

```bash
cd bible-book-bg-script
python3 generate_prompts.py
```

*(Or use `python3 main.py`)*

### 2. Workflow with Google Flow

#### Workflow A: Generate Backgrounds (Mode 1)
1. Select **Option 1**.
2. **Step 1 (Prompt)**: The script automatically copies the background prompt (e.g. **Genesis**) to your clipboard.
3. In **Google Flow**, paste the prompt to generate the 16:9 background image.
4. Press **`[Enter]`** in terminal -> **Step 2 (Filename)**: copies `01-genesis`.
5. Paste `01-genesis` when saving the generated image.
6. Press **`[Enter]`** again to advance to **Exodus**.

#### Workflow B: Add Titles (Modes 2, 3, or 4)
1. Select **Option 2 (EN)**, **Option 3 (ES)**, or **Option 4 (PT)**.
2. In **Google Flow**, attach the generated background image.
3. Paste the copied title prompt into Google Flow to generate the final titled image.
4. Press **`[Enter]`** in terminal to copy filename / advance to the next book.

---

## Interactive Controls

| Command | Action |
| --- | --- |
| `[Enter]` or `n` | **Step 1 -> Step 2**: Copy filename<br>**Step 2 -> Next Book**: Copy next book prompt |
| `f` | **Copy filename** immediately to clipboard |
| `b` or `p` | **Go back** (from filename back to prompt, or back to previous book) |
| `r` | **Re-copy** current item (prompt or filename) to clipboard |
| `m` | **Switch mode** (1: Background, 2: EN Title, 3: ES Title, 4: PT Title) |
| `g <query>` | **Jump** directly to a book (e.g. `g 40`, `g Matthew`, `g Mateo`, `g Mateus`) |
| `q` or `exit` | **Quit** the program |

---

## Command-Line Options

```text
usage: generate_prompts.py [-h] [-m MODE] [-d DATA] [-t TEMPLATE] [-s START] [-b BOOK] [-l] [--dump] [--single-step]

Modes:
  1, bg          Background Image Prompts (Cinematic 16:9, completely without text)
  2, en, title-en Add English Title to Attached Image (KJV Name - e.g. "GENESIS")
  3, es, title-es Add Spanish Title to Attached Image (Reina Valera Name - e.g. "GÉNESIS")
  4, pt, title-pt Add Portuguese Title to Attached Image (ARC Name - e.g. "GÊNESIS")

Options:
  -m, --mode MODE       Operation mode (1, 2, 3, 4, bg, title-en, title-es, title-pt)
  -d, --data DATA       Path to books JSON file (default: books-data.json)
  -t, --template PATH   Path to custom template file
  -s, --start NUMBER    Starting book number (1-66, default: 1)
  -b, --book NAME       Start at a specific book name (e.g. 'Matthew', 'Mateo', 'João')
  -l, --list            List all 66 books in EN / ES / PT with filenames and exit
  --dump                Render and print all 66 prompts to stdout
  --single-step, --fast Advance directly to the next book on Enter
```

### CLI Examples

```bash
# Start directly with Spanish titles (Reina Valera)
python3 generate_prompts.py --mode 3

# Start with Portuguese titles starting at Matthew (book 40)
python3 generate_prompts.py --mode pt --start 40

# Start at Psalms in Spanish
python3 generate_prompts.py --mode es --book Salmos

# List all 66 books with English, Spanish, and Portuguese names
python3 generate_prompts.py --list

# Dump all 66 Spanish title prompts to a file
python3 generate_prompts.py --dump --mode es > spanish_prompts.txt
```

---

## Templates & Variables

- **`template_bg.txt`**: Used for Mode 1 (Backgrounds). Focuses on cinematic realism, lighting, and negative space.
- **`template_title.txt`**: Used for Modes 2, 3, and 4 (Titles). Focuses on monumental Roman serif typography, anti-translation instructions, and background preservation.

### Available Template Variables

| Variable | Description | Example Value |
| --- | --- | --- |
| `{title}` | Localized title for active mode | `Génesis` / `Gênesis` / `Genesis` |
| `{title_upper}` | Localized title in UPPERCASE | `GÉNESIS` / `GÊNESIS` / `GENESIS` |
| `{language}` | Target title language name | `Spanish` / `Portuguese` / `English` |
| `{name}` / `{name_en}` | English KJV book name | `Genesis` |
| `{name_es}` | Spanish Reina Valera book name | `Génesis` |
| `{name_pt}` | Portuguese ARC book name | `Gênesis` |
| `{order}` | Sequential book number (1 to 66) | `1` |
| `{id}` | Normalized book slug | `genesis` |
| `{filename}` | Standardized filename | `01-genesis` |
| `{theme}` | Central theological theme | `Creation, beginnings...` |
| `{setting}` | Geographical setting | `Ancient Near East, Mount Ararat...` |
| `{visual_elements}` | Visual motifs | `Vast untouched desert landscape...` |
| `{mood}` | Emotional and atmospheric tone | `Serene, contemplative, historical` |
| `{lighting}` | Lighting style | `Soft natural starlight, golden hour` |
| `{color_palette}` | Harmonic color scheme | `Muted earth tones, sandstone beige` |
