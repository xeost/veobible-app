#!/usr/bin/env python3
"""
import-ebible-spabll.py
=======================
Downloads or reads the "Santa Biblia Libre Latinoamericano" (spabll) from
eBible.org in VPL (Verse Per Line) format and converts it to the veobible-app
storage structure under `frontend/public/bible-data/es/spabll`.

Source format (VPL)
-------------------
The VPL zip contains a single text file where every line has the form:

    GEN 1:1 En el principio, Dios creó los cielos y la tierra.
    GEN 1:2 Y la tierra estaba desordenada y vacía ...
    ...

The book abbreviations follow the eBible / USFM standard (uppercase 3-letter).

Output structure
----------------
frontend/public/bible-data/es/spabll/
  index.json                 <- Version metadata & book index
  genesis.json               <- Per-book merged JSON  {"1": [{verse, text}, ...], ...}
  exodus.json
  ...
  genesis/                   <- Per-chapter JSON files  [{verse, text}, ...]
    1.json
    2.json
    ...

Usage
-----
    python3 scripts/import-ebible-spabll.py

Options
-------
    --source SOURCE   URL to spabll_vpl.zip or path to a local .zip/.txt file
                      (default: https://eBible.org/Scriptures/spabll_vpl.zip)
    --output-dir DIR  Destination directory
                      (default: frontend/public/bible-data/es/spabll)
    --force           Overwrite existing files without warning
    --pretty          Write indented JSON for debugging
    --dry-run         Preview actions without writing files
    --help            Show this message and exit
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import urllib.request
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Canonical 66 Bible books with Spanish metadata and their eBible/USFM codes
# ---------------------------------------------------------------------------
BOOK_DEFINITIONS = [
    # (usfm_code, id, name, slug, abbr, testament, description)
    ("GEN", "genesis", "Génesis", "genesis", "Gn", "old",
     "El libro de los comienzos: la creación del mundo, la caída del hombre y los orígenes de la nación de Israel."),
    ("EXO", "exodus", "Éxodo", "exodo", "Éx", "old",
     "La liberación del pueblo de Israel de la esclavitud en Egipto bajo el liderazgo de Moisés y la entrega de la Ley en el monte Sinaí."),
    ("LEV", "leviticus", "Levítico", "levitico", "Lv", "old",
     "Manual de leyes y regulaciones para el sacerdocio y el pueblo de Israel, enfatizando la santidad de Dios."),
    ("NUM", "numbers", "Números", "numeros", "Nm", "old",
     "Narra el viaje de los israelitas por el desierto durante cuarenta años y la fidelidad de Dios."),
    ("DEU", "deuteronomy", "Deuteronomio", "deuteronomio", "Dt", "old",
     "La repetición de la Ley por Moisés antes de que Israel entrara en la Tierra Prometida, llamando a la obediencia y al amor a Dios."),
    ("JOS", "joshua", "Josué", "josue", "Jos", "old",
     "La conquista de Canaán liderada por Josué y la división de la tierra entre las tribus de Israel."),
    ("JDG", "judges", "Jueces", "jueces", "Jue", "old",
     "Historia de los líderes y libertadores de Israel durante el período de ciclos de pecado, opresión y liberación."),
    ("RUT", "ruth", "Rut", "rut", "Rt", "old",
     "Una conmovedora historia de lealtad, fe y redención en la vida de Rut y Booz, ancestros del Rey David."),
    ("1SA", "1-samuel", "1 Samuel", "1-samuel", "1S", "old",
     "La transición de Israel de jueces a monarquía, con las historias de Samuel, Saúl y David."),
    ("2SA", "2-samuel", "2 Samuel", "2-samuel", "2S", "old",
     "El reinado del Rey David sobre Israel, sus victorias, sus fallos y el pacto de Dios con su dinastía."),
    ("1KI", "1-kings", "1 Reyes", "1-reyes", "1R", "old",
     "El reinado de Salomón, la construcción del Templo y la subsiguiente división del reino en Israel y Judá."),
    ("2KI", "2-kings", "2 Reyes", "2-reyes", "2R", "old",
     "El declive y caída de los reinos divididos de Israel y Judá, culminando en el exilio babilónico."),
    ("1CH", "1-chronicles", "1 Crónicas", "1-cronicas", "1Cr", "old",
     "Genealogías sagradas e historia detallada del reinado de David, enfocándose en la adoración y el Templo."),
    ("2CH", "2-chronicles", "2 Crónicas", "2-cronicas", "2Cr", "old",
     "El reinado de Salomón, la construcción del Templo y la historia de los reyes de Judá hasta el exilio."),
    ("EZR", "ezra", "Esdras", "esdras", "Esd", "old",
     "El retorno de los exiliados judíos de Babilonia a Jerusalén y la reconstrucción del Templo bajo el liderazgo de Esdras."),
    ("NEH", "nehemiah", "Nehemías", "nehemias", "Neh", "old",
     "La reconstrucción de los muros de Jerusalén por Nehemías y la renovación espiritual del pueblo."),
    ("EST", "esther", "Ester", "ester", "Est", "old",
     "Cómo la reina Ester y su tío Mardoqueo salvaron al pueblo judío de la destrucción en el imperio persa."),
    ("JOB", "job", "Job", "job", "Job", "old",
     "Una profunda reflexión sobre el sufrimiento de los justos, la soberanía de Dios y la fe ante las pruebas."),
    ("PSA", "psalms", "Salmos", "salmos", "Sal", "old",
     "Colección de oraciones, alabanzas y poemas inspirados que cubren toda la gama de la experiencia humana con Dios."),
    ("PRO", "proverbs", "Proverbios", "proverbios", "Pr", "old",
     "Sabiduría práctica para la vida diaria basada en el temor al Señor, cubriendo relaciones, trabajo e integridad."),
    ("ECC", "ecclesiastes", "Eclesiastés", "eclesiastes", "Ec", "old",
     "Una búsqueda del sentido de la vida bajo el sol, concluyendo que temer a Dios es el deber supremo del hombre."),
    ("SOL", "song-of-solomon", "Cantares", "cantares", "Cnt", "old",
     "Un poema de amor que celebra la belleza del amor conyugal y la relación entre Dios y su pueblo."),
    ("ISA", "isaiah", "Isaías", "isaias", "Is", "old",
     "Profecías sobre el juicio de Israel y las naciones, la promesa del Mesías Siervo Sufriente y la gloria futura."),
    ("JER", "jeremiah", "Jeremías", "jeremias", "Jer", "old",
     "Las advertencias del profeta llorón sobre la inminente destrucción de Jerusalén y la promesa de un nuevo pacto."),
    ("LAM", "lamentations", "Lamentaciones", "lamentaciones", "Lam", "old",
     "Poemas de llanto y lamento por la destrucción de Jerusalén y el Templo, reafirmando la fidelidad de Dios."),
    ("EZE", "ezekiel", "Ezequiel", "ezequiel", "Ez", "old",
     "Visiones proféticas dramáticas de la gloria de Dios, el juicio de Judá y la futura restauración del Templo y del pueblo."),
    ("DAN", "daniel", "Daniel", "daniel", "Dn", "old",
     "Historias de fidelidad a Dios en el exilio babilónico y visiones apocalípticas del reino eterno de Dios."),
    ("HOS", "hosea", "Oseas", "oseas", "Os", "old",
     "El matrimonio profético de Oseas simbolizando el amor incondicional de Dios por su pueblo infiel."),
    ("JOE", "joel", "Joel", "joel", "Jl", "old",
     "Una plaga de langostas usada como advertencia del Día del Señor y la promesa del derramamiento del Espíritu de Dios."),
    ("AMO", "amos", "Amós", "amos", "Am", "old",
     "El llamado a la justicia social y al arrepentimiento sincero dirigido al reino del norte de Israel."),
    ("OBA", "obadiah", "Abdías", "abdias", "Abd", "old",
     "Una profecía de juicio contra Edom por su orgullo y violencia contra su hermano Jacob."),
    ("JON", "jonah", "Jonás", "jonas", "Jon", "old",
     "La renuencia del profeta Jonás a predicar a Nínive y la compasión universal de Dios por las naciones."),
    ("MIC", "micah", "Miqueas", "miqueas", "Miq", "old",
     "Denuncia de la injusticia de los líderes y la promesa de un Gobernante nacido en Belén que traerá paz."),
    ("NAH", "nahum", "Nahúm", "nahum", "Nah", "old", 
     "Una declaración del juicio de Dios sobre el imperio asirio y la destrucción de la ciudad de Nínive."),
    ("HAB", "habakkuk", "Habacuc", "habacuc", "Hab", "old",
     "Un diálogo honesto entre el profeta y Dios sobre la justicia divina, concluyendo con una declaración de fe triunfante."),
    ("ZEP", "zephaniah", "Sofonías", "sofonias", "Sof", "old",
     "La inminencia del Día del Señor, la purificación de un remanente humilde y la promesa de restauración."),
    ("HAG", "haggai", "Hageo", "hageo", "Hag", "old",
     "Exhortaciones al pueblo que regresó del exilio para priorizar la reconstrucción de la Casa de Dios."),
    ("ZEC", "zechariah", "Zacarías", "zacarias", "Zac", "old",
     "Visiones proféticas alentadoras sobre la restauración de Jerusalén y profecías mesiánicas sobre el Rey venidero."),
    ("MAL", "malachi", "Malaquías", "malaquias", "Mal", "old",
     "El último profeta del Antiguo Testamento reprende la apatía religiosa y anuncia la venida del mensajero del Señor."),
    ("MAT", "matthew", "Mateo", "mateo", "Mt", "new",
     "El Evangelio escrito para demostrar que Jesús es el Mesías prometido en el Antiguo Testamento y el Rey de los judíos."),
    ("MAR", "mark", "Marcos", "marcos", "Mr", "new",
     "Un relato dinámico y centrado en la acción que retrata a Jesús como el Siervo Sufriente e Hijo de Dios."),
    ("LUK", "luke", "Lucas", "lucas", "Lc", "new",
     "Un relato histórico minucioso del Evangelio que enfatiza la compasión de Jesús por todos los necesitados."),
    ("JOH", "john", "Juan", "juan", "Jn", "new",
     "Un Evangelio profundo centrado en la divinidad de Jesucristo, la Palabra encarnada que concede vida eterna."),
    ("ACT", "acts", "Hechos", "hechos", "Hch", "new",
     "La historia del nacimiento de la Iglesia y la expansión del Evangelio por el poder del Espíritu Santo de Jerusalén a Roma."),
    ("ROM", "romans", "Romanos", "romanos", "Ro", "new",
     "Una exposición sistemática del evangelio, explicando la justificación por la fe, la gracia y la vida en el Espíritu."),
    ("1CO", "1-corinthians", "1 Corintios", "1-corintios", "1Co", "new",
     "Carta que aborda divisiones en la iglesia, ética cristiana, los dones espirituales y la verdad de la resurrección."),
    ("2CO", "2-corinthians", "2 Corintios", "2-corintios", "2Co", "new",
     "Una defensa apasionada del ministerio apostólico de Pablo, enfatizando la gracia de Dios en la debilidad humana."),
    ("GAL", "galatians", "Gálatas", "galatas", "Gá", "new",
     "Defensa de la libertad cristiana y de la justificación solo por la fe, contra el legalismo."),
    ("EPH", "ephesians", "Efesios", "efesios", "Ef", "new",
     "Explora las bendiciones espirituales en Cristo, la unidad de la Iglesia y la armadura de Dios."),
    ("PHI", "philippians", "Filipenses", "filipenses", "Fil", "new",
     "Una carta llena de alegría y gratitud, alentando la humildad, la unidad y la confianza en Cristo."),
    ("COL", "colossians", "Colosenses", "colosenses", "Col", "new",
     "Destaca la supremacía y suficiencia de Cristo sobre toda la creación y sobre la Iglesia."),
    ("1TH", "1-thessalonians", "1 Tesalonicenses", "1-tesalonicenses", "1Ts", "new",
     "Aliento para vivir una vida santa y enseñanzas sobre la segunda venida de Cristo."),
    ("2TH", "2-thessalonians", "2 Tesalonicenses", "2-tesalonicenses", "2Ts", "new",
     "Aclaraciones sobre los eventos que preceden al Día del Señor y exhortaciones a la firmeza."),
    ("1TI", "1-timothy", "1 Timoteo", "1-timoteo", "1Ti", "new",
     "Instrucciones pastorales sobre el gobierno de la iglesia, el liderazgo y la preservación de la sana doctrina."),
    ("2TI", "2-timothy", "2 Timoteo", "2-timoteo", "2Ti", "new",
     "La última carta de Pablo a Timoteo, exhortándolo a perseverar en el ministerio y a predicar la palabra."),
    ("TIT", "titus", "Tito", "tito", "Tit", "new",
     "Instrucciones para la organización de las iglesias en Creta, destacando la enseñanza correcta y las buenas obras."),
    ("PHM", "philemon", "Filemón", "filemon", "Flm", "new",
     "Una carta personal pidiendo que un siervo fugitivo, Onésimo, sea recibido como hermano en Cristo."),
    ("HEB", "hebrews", "Hebreos", "hebreos", "He", "new",
     "Demuestra la superioridad de Cristo y de su nuevo pacto sobre el antiguo sistema sacrificial."),
    ("JAM", "james", "Santiago", "santiago", "Stg", "new",
     "Enseñanzas prácticas que muestran que la fe verdadera debe manifestarse en buenas obras y sabiduría."),
    ("1PE", "1-peter", "1 Pedro", "1-pedro", "1P", "new",
     "Aliento a los cristianos perseguidos para mantenerse firmes en la esperanza y vivir en santidad."),
    ("2PE", "2-peter", "2 Pedro", "2-pedro", "2P", "new",
     "Advertencias contra falsos maestros y exhortaciones al crecimiento en el conocimiento de Cristo."),
    ("1JO", "1-john", "1 Juan", "1-juan", "1Jn", "new",
     "Epístola sobre la certeza de la salvación, el mandamiento del amor fraternal y la comunión con Dios."),
    ("2JO", "2-john", "2 Juan", "2-juan", "2Jn", "new",
     "Advertencia contra acoger a falsos maestros que niegan la verdad sobre Jesucristo."),
    ("3JO", "3-john", "3 Juan", "3-juan", "3Jn", "new",
     "Elogio de la hospitalidad de Gayo hacia los misioneros y reprensión de actitudes orgullosas."),
    ("JUD", "jude", "Judas", "judas", "Jud", "new",
     "Exhortación urgente a batallar por la fe ante falsos maestros que distorsionan la gracia."),
    ("REV", "revelation", "Apocalipsis", "apocalipsis", "Ap", "new",
     "Visiones de la victoria final de Cristo sobre el mal, el juicio final y la nueva Jerusalén."),
]

# Build a lookup: USFM code -> index in BOOK_DEFINITIONS
USFM_TO_INDEX: dict[str, int] = {row[0]: i for i, row in enumerate(BOOK_DEFINITIONS)}

# Deuterocanonical / apocryphal book codes present in eBible VPL files.
# Lines with these codes are intentionally skipped (not part of the 66-book canon).
DEUTEROCANONICAL_CODES: frozenset[str] = frozenset({
    "TOB", "JDT", "1MA", "2MA", "3MA", "4MA",
    "WIS", "SIR", "BAR", "1ES", "2ES", "4ES",
    "MAN", "PS2", "ODE", "PSS", "EZA", "5EZ", "6EZ",
    "DAG", "SUS", "BEL", "LJE", "ESG", "DNG", "PSX", "PRM",
})


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

def load_vpl_text(source: str) -> str:
    """
    Download or read the VPL source and return its text content.

    The source may be:
      - A URL to a .zip file  -> download and extract the inner .txt file
      - A local .zip file     -> extract the inner .txt file
      - A local .txt file     -> read directly
    """
    def _extract_txt_from_zip(raw_bytes: bytes) -> str:
        with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
            txt_names = [n for n in zf.namelist() if n.lower().endswith(".txt")]
            if not txt_names:
                raise RuntimeError("No .txt file found inside the zip archive.")
            # Prefer a file whose name contains the Bible ID
            preferred = [n for n in txt_names if "spabll" in n.lower()]
            chosen = preferred[0] if preferred else txt_names[0]
            print(f"  Extracting '{chosen}' from zip...")
            return zf.read(chosen).decode("utf-8")

    if source.startswith("http://") or source.startswith("https://"):
        print(f"Fetching source from URL: {source}...")
        req = urllib.request.Request(source, headers={"User-Agent": "VeoBible/1.0"})
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
        if source.lower().endswith(".zip"):
            return _extract_txt_from_zip(raw)
        return raw.decode("utf-8")

    path = Path(source)
    if not path.exists():
        raise RuntimeError(f"Source file not found: {path}")
    print(f"Reading local source: {path}...")
    if path.suffix.lower() == ".zip":
        return _extract_txt_from_zip(path.read_bytes())
    return path.read_text(encoding="utf-8")


def write_json(
    path: Path,
    data: object,
    *,
    pretty: bool = False,
    dry_run: bool = False,
) -> None:
    """Write data as JSON to path."""
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    indent = 2 if pretty else None
    separators = None if pretty else (",", ":")
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=indent, separators=separators)


# ---------------------------------------------------------------------------
# VPL parser
# ---------------------------------------------------------------------------

def parse_vpl(text: str) -> list[dict[str, list[dict]]]:
    """
    Parse a VPL text file and return a list of 66 book structures.

    Each book structure is a dict mapping chapter number (str) to a list of
    verse dicts: [{"verse": int, "text": str}, ...]

    Returns a list indexed by canonical book order (same as BOOK_DEFINITIONS).
    """
    # books_data[i] = { "1": [{verse, text}, ...], "2": [...], ... }
    books_data: list[dict[str, list[dict]]] = [{} for _ in BOOK_DEFINITIONS]

    skipped_deuterocanonical = 0
    skipped_unknown = 0

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # Expected format: "USFM_CODE CH:V text..."
        parts = line.split(" ", 2)
        if len(parts) < 3:
            skipped_unknown += 1
            continue

        usfm_code, ref, verse_text = parts[0], parts[1], parts[2]

        if ":" not in ref:
            skipped_lines += 1
            continue

        book_idx = USFM_TO_INDEX.get(usfm_code)
        if book_idx is None:
            if usfm_code in DEUTEROCANONICAL_CODES:
                skipped_deuterocanonical += 1
            else:
                skipped_unknown += 1
            continue

        try:
            ch_str, v_str = ref.split(":", 1)
            ch_num = int(ch_str)
            v_num = int(v_str)
        except ValueError:
            skipped_lines += 1
            continue

        ch_key = str(ch_num)
        book = books_data[book_idx]
        if ch_key not in book:
            book[ch_key] = []
        book[ch_key].append({"verse": v_num, "text": verse_text.strip()})

    if skipped_deuterocanonical:
        print(
            f"  Info: skipped {skipped_deuterocanonical} lines from deuterocanonical/"
            "apocryphal books (expected — not part of the 66-book canon)."
        )
    if skipped_unknown:
        print(f"  Warning: skipped {skipped_unknown} truly unrecognised lines — check the source file.")

    return books_data


# ---------------------------------------------------------------------------
# Main processor
# ---------------------------------------------------------------------------

def process_bible(
    books_data: list[dict[str, list[dict]]],
    output_dir: Path,
    *,
    force: bool = False,
    pretty: bool = False,
    dry_run: bool = False,
) -> None:
    """Build index.json, per-book .json files, and per-chapter .json files."""

    index_books = []
    total_chapters = 0
    total_verses = 0

    for i, row in enumerate(BOOK_DEFINITIONS):
        usfm_code, book_id, book_name, slug, abbr, testament, description = row

        book_chapters: dict[str, list[dict]] = books_data[i]

        if not book_chapters:
            print(f"  Warning: no verses found for {book_id} ({usfm_code}).")

        # Sort chapters numerically
        sorted_ch_keys = sorted(book_chapters.keys(), key=lambda k: int(k))

        verses_per_chapter: list[int] = []
        book_dict: dict[str, list[dict]] = {}

        book_dir = output_dir / book_id

        for ch_key in sorted_ch_keys:
            verses = book_chapters[ch_key]
            # Sort verses numerically (should already be in order)
            verses_sorted = sorted(verses, key=lambda v: v["verse"])

            verses_per_chapter.append(len(verses_sorted))
            total_verses += len(verses_sorted)
            total_chapters += 1

            book_dict[ch_key] = verses_sorted

            # Write per-chapter file: {output_dir}/{book_id}/{ch_num}.json
            ch_file = book_dir / f"{ch_key}.json"
            if not dry_run and (not ch_file.exists() or force):
                write_json(ch_file, verses_sorted, pretty=pretty, dry_run=dry_run)

        # Write per-book file: {output_dir}/{book_id}.json
        book_file = output_dir / f"{book_id}.json"
        if not dry_run and (not book_file.exists() or force):
            write_json(book_file, book_dict, pretty=pretty, dry_run=dry_run)

        index_books.append(
            {
                "id": book_id,
                "name": book_name,
                "slug": slug,
                "abbr": abbr,
                "testament": testament,
                "chapters": len(sorted_ch_keys),
                "versesPerChapter": verses_per_chapter,
                "description": description,
            }
        )

    # Build index.json
    index_data = {
        "metadata": {
            "name": "Santa Biblia Libre Latinoamericano",
            "shortname": "BLL",
            "slug": "spabll",
            "year": "2026",
            "language": "Spanish",
            "copyright": "Esta Biblia es de dominio público.",
            "description": (
                "La Santa Biblia Libre Latinoamericano (BLL) es una traducción en el dialecto "
                "latinoamericano del español. Es un borrador de traducción de dominio público, "
                "disponible a través de eBible.org."
            ),
        },
        "books": index_books,
    }

    index_file = output_dir / "index.json"
    if not dry_run and (not index_file.exists() or force):
        write_json(index_file, index_data, pretty=pretty, dry_run=dry_run)

    print(
        f"\nProcessing complete ({'DRY RUN' if dry_run else 'SUCCESS'}):\n"
        f"  - Target directory : {output_dir}\n"
        f"  - Books            : {len(index_books)}\n"
        f"  - Chapters         : {total_chapters}\n"
        f"  - Verses           : {total_verses}"
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Import 'Santa Biblia Libre Latinoamericano' (spabll) from eBible.org "
            "VPL format to the veobible-app JSON structure."
        )
    )
    parser.add_argument(
        "--source",
        default="https://eBible.org/Scriptures/spabll_vpl.zip",
        help=(
            "URL to spabll_vpl.zip, or path to a local .zip or .txt file "
            "(default: https://eBible.org/Scriptures/spabll_vpl.zip)"
        ),
    )
    parser.add_argument(
        "--output-dir",
        default="frontend/public/bible-data/es/spabll",
        help="Target output directory (default: frontend/public/bible-data/es/spabll)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Write indented JSON (useful for debugging)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview operations without creating any files",
    )

    args = parser.parse_args()

    # Resolve output directory relative to the repo root when not absolute
    repo_root = Path(__file__).resolve().parent.parent
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = repo_root / output_dir

    try:
        vpl_text = load_vpl_text(args.source)
        print("Parsing VPL data...")
        books_data = parse_vpl(vpl_text)
        process_bible(
            books_data,
            output_dir,
            force=args.force,
            pretty=args.pretty,
            dry_run=args.dry_run,
        )
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
