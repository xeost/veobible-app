#!/usr/bin/env python3
"""
import-getbible-arc.py
=====================
Downloads or reads the Almeida Revista e Corrigida (ARC) Portuguese Bible JSON
from GetBible API v2 (https://api.getbible.net/v2/almeida.json) and converts it
to the veobible-app storage structure under `frontend/public/bible-data/pt/arc`.

Output structure
----------------
frontend/public/bible-data/pt/arc/
  index.json                 <- Version metadata & book index
  genesis.json               <- Per-book merged JSON
  exodus.json
  ...
  genesis/                   <- Per-chapter JSON files
    1.json
    2.json
    ...

Usage
-----
    python3 scripts/import-getbible-arc.py

Options
-------
    --source SOURCE   URL or local file path to almeida.json
                      (default: https://api.getbible.net/v2/almeida.json)
    --output-dir DIR  Destination directory
                      (default: frontend/public/bible-data/pt/arc)
    --force           Overwrite existing files without warning
    --pretty          Write indented JSON for debugging
    --dry-run         Preview actions without writing files
    --help            Show this message and exit
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

# Canonical 66 Bible books with Portuguese metadata
BOOK_DEFINITIONS = [
    {"id": "genesis", "slug": "genesis", "abbr": "Gn", "testament": "old", "description": "O livro dos começos, narrando a criação do mundo, a queda do homem e as origens da nação de Israel."},
    {"id": "exodus", "slug": "exodo", "abbr": "Êx", "testament": "old", "description": "Relata a libertação do povo de Israel da escravidão no Egito sob a liderança de Moisés e a entrega da Lei no monte Sinai."},
    {"id": "leviticus", "slug": "levitico", "abbr": "Lv", "testament": "old", "description": "Um manual de leis e regulamentos para o sacerdócio e o povo de Israel, enfatizando a santidade de Deus."},
    {"id": "numbers", "slug": "numeros", "abbr": "Nm", "testament": "old", "description": "Narra a jornada dos israelitas pelo deserto durante quarenta anos e a fidelidade de Deus."},
    {"id": "deuteronomy", "slug": "deuteronomio", "abbr": "Dt", "testament": "old", "description": "A repetição da Lei por Moisés antes de Israel entrar na Terra Prometida, chamando à obediência e ao amor a Deus."},
    {"id": "joshua", "slug": "josue", "abbr": "Js", "testament": "old", "description": "Relata a conquista de Canaã liderada por Josué e a divisão da terra entre as tribos de Israel."},
    {"id": "judges", "slug": "juizes", "abbr": "Jz", "testament": "old", "description": "História dos líderes e libertadores de Israel durante o período de ciclos de pecado, opressão e libertação."},
    {"id": "ruth", "slug": "rute", "abbr": "Rt", "testament": "old", "description": "Uma história comovente de lealdade, fé e redenção na vida de Rute e Boaz, ancestrais do Rei Davi."},
    {"id": "1-samuel", "slug": "1-samuel", "abbr": "1Sm", "testament": "old", "description": "A transição de Israel de juízes para a monarquia, com as histórias de Samuel, Saul e Davi."},
    {"id": "2-samuel", "slug": "2-samuel", "abbr": "2Sm", "testament": "old", "description": "O reinado do Rei Davi sobre Israel, suas vitórias, suas falhas e a aliança de Deus com sua dinastia."},
    {"id": "1-kings", "slug": "1-reis", "abbr": "1Rs", "testament": "old", "description": "O reinado de Salomão, a construção do Templo e a subsequente divisão do reino em Israel e Judá."},
    {"id": "2-kings", "slug": "2-reis", "abbr": "2Rs", "testament": "old", "description": "O declínio e queda dos reinos divididos de Israel e Judá, culminando no exílio babilônico."},
    {"id": "1-chronicles", "slug": "1-cronicas", "abbr": "1Cr", "testament": "old", "description": "Genealogias sagradas e a história detalhada do reinado de Davi focando na adoração e no Templo."},
    {"id": "2-chronicles", "slug": "2-cronicas", "abbr": "2Cr", "testament": "old", "description": "O reinado de Salomão, a construção do Templo e a história dos reis de Judá até o exílio."},
    {"id": "ezra", "slug": "esdras", "abbr": "Esd", "testament": "old", "description": "O retorno dos exilados judeus da Babilônia para Jerusalém e a reconstrução do Templo sob a liderança de Esdras."},
    {"id": "nehemiah", "slug": "neemias", "abbr": "Ne", "testament": "old", "description": "A reconstrução dos muros de Jerusalém por Neemias e a renovação espiritual do povo."},
    {"id": "esther", "slug": "ester", "abbr": "Et", "testament": "old", "description": "Como a rainha Ester e seu tio Mordecai salvaram o povo judeu da destruição no império persa."},
    {"id": "job", "slug": "jo", "abbr": "Jó", "testament": "old", "description": "Uma profunda reflexão sobre o sofrimento dos justos, a soberania de Deus e a fé diante das provações."},
    {"id": "psalms", "slug": "salmos", "abbr": "Sl", "testament": "old", "description": "Coleção de orações, louvores e poemas inspirados cobrindo toda a gama da experiência humana com Deus."},
    {"id": "proverbs", "slug": "proverbios", "abbr": "Pv", "testament": "old", "description": "Sabedoria prática para a vida diária baseada no temor ao Senhor, cobrindo relacionamentos, trabalho e integridade."},
    {"id": "ecclesiastes", "slug": "eclesiastes", "abbr": "Ec", "testament": "old", "description": "Uma busca pelo sentido da vida sob o sol, concluindo que temer a Deus é o dever supremo do homem."},
    {"id": "song-of-solomon", "slug": "cantico-dos-canticos", "abbr": "Ct", "testament": "old", "description": "Um poema amoroso celebrando a beleza do amor conjugal e o relacionamento entre Deus e seu povo."},
    {"id": "isaiah", "slug": "isaias", "abbr": "Is", "testament": "old", "description": "Profecias sobre o julgamento de Israel e as nações, a promessa do Messias Servo Sofredor e a glória futura."},
    {"id": "jeremiah", "slug": "jeremias", "abbr": "Jr", "testament": "old", "description": "As advertências do profeta chorado sobre a destruição iminente de Jerusalém e a promessa de uma nova aliança."},
    {"id": "lamentations", "slug": "lamentacoes", "abbr": "Lm", "testament": "old", "description": "Poemas de choro e lamento pela destruição de Jerusalém e pelo Templo, reafirmando a fidelidade de Deus."},
    {"id": "ezekiel", "slug": "ezequiel", "abbr": "Ez", "testament": "old", "description": "Visões proféticas dramáticas da glória de Deus, o julgamento de Judá e a restauração futura do Templo e do povo."},
    {"id": "daniel", "slug": "daniel", "abbr": "Dn", "testament": "old", "description": "Histórias de fidelidade a Deus no exílio babilônico e visões apocalípticas do reino eterno de Deus."},
    {"id": "hosea", "slug": "oseias", "abbr": "Os", "testament": "old", "description": "O casamento profético de Oseias simbolizando o amor incondicional de Deus por seu povo infiel."},
    {"id": "joel", "slug": "joel", "abbr": "Jl", "testament": "old", "description": "Uma praga de gafanhotos usada como aviso do Dia do Senhor e a promessa do derramamento do Espírito de Deus."},
    {"id": "amos", "slug": "amos", "abbr": "Am", "testament": "old", "description": "O chamado à justiça social e ao arrependimento sincero dirigido ao reino do norte de Israel."},
    {"id": "obadiah", "slug": "obadias", "abbr": "Ob", "testament": "old", "description": "Uma profecia de julgamento contra Edom por seu orgulho e violência contra seu irmão Jacó."},
    {"id": "jonah", "slug": "jonas", "abbr": "Jn", "testament": "old", "description": "A relutância do profeta Jonas em pregar a Nínive e a compaixão universal de Deus pelas nações."},
    {"id": "micah", "slug": "miqueias", "abbr": "Mq", "testament": "old", "description": "Denúncia da injustiça dos líderes e a promessa de um Governador nascido em Belém que trará paz."},
    {"id": "nahum", "slug": "naum", "abbr": "Na", "testament": "old", "description": "Uma declaração do julgamento de Deus sobre o império assírio e a destruição da cidade de Nínive."},
    {"id": "habakkuk", "slug": "habacuque", "abbr": "Hc", "testament": "old", "description": "Um diálogo honesto entre o profeta e Deus sobre a justiça divina, concluindo com uma declaração de fé triunfante."},
    {"id": "zephaniah", "slug": "sofonias", "abbr": "Sf", "testament": "old", "description": "A iminência do Dia do Senhor, a purificação de um remanescente humilde e a promessa de restauração."},
    {"id": "haggai", "slug": "ageu", "abbr": "Hg", "testament": "old", "description": "Exortações ao povo retornado do exílio para priorizar a reconstrução da Casa de Deus."},
    {"id": "zechariah", "slug": "zacarias", "abbr": "Zc", "testament": "old", "description": "Visões proféticas encorajadoras sobre a restauração de Jerusalém e profecias messiânicas sobre o Rei vindouro."},
    {"id": "malachi", "slug": "malaquias", "abbr": "Ml", "testament": "old", "description": "O último profeta do Antigo Testamento repreendendo a apatia religiosa e anunciando a vinda do mensageiro do Senhor."},
    {"id": "matthew", "slug": "mateus", "abbr": "Mt", "testament": "new", "description": "O Evangelho escrito para demonstrar que Jesus é o Messias prometido no Antigo Testamento e o Rei dos judeus."},
    {"id": "mark", "slug": "marcos", "abbr": "Mc", "testament": "new", "description": "Um relato dinâmico e focado na ação retratando Jesus como o Servo Sofredor e Filho de Deus."},
    {"id": "luke", "slug": "lucas", "abbr": "Lc", "testament": "new", "description": "Um relato histórico minucioso do Evangelho enfatizando a compaixão de Jesus por todos os necessitados."},
    {"id": "john", "slug": "joao", "abbr": "Jo", "testament": "new", "description": "Um Evangelho profundo focado na divindade de Jesus Cristo, a Palavra encarnada que concede vida eterna."},
    {"id": "acts", "slug": "atos", "abbr": "At", "testament": "new", "description": "A história do nascimento da Igreja e a expansão do Evangelho pelo poder do Espírito Santo de Jerusalém a Roma."},
    {"id": "romans", "slug": "romanos", "abbr": "Rm", "testament": "new", "description": "Uma exposição sistemática do evangelho, explicando a justificação pela fé, a graça e a vida no Espírito."},
    {"id": "1-corinthians", "slug": "1-corintios", "abbr": "1Co", "testament": "new", "description": "Carta abordando divisões na igreja, ética cristã, os dons espirituais e a verdade da ressurreição."},
    {"id": "2-corinthians", "slug": "2-corintios", "abbr": "2Co", "testament": "new", "description": "Uma defesa apaixonada do ministério apostólico de Paulo, enfatizando a graça de Deus na fraqueza humana."},
    {"id": "galatians", "slug": "galatas", "abbr": "Gl", "testament": "new", "description": "Defesa da liberdade cristã e da justificação somente pela fé, contra o legalismo."},
    {"id": "ephesians", "slug": "efesios", "abbr": "Ef", "testament": "new", "description": "Explora as bênçãos espirituais em Cristo, a unidade da Igreja e a armadura de Deus."},
    {"id": "philippians", "slug": "filipenses", "abbr": "Fp", "testament": "new", "description": "Uma carta cheia de alegria e gratidão, incentivando a humildade, unidade e confiança em Cristo."},
    {"id": "colossians", "slug": "colossenses", "abbr": "Cl", "testament": "new", "description": "Destaca a supremacia e suficiência de Cristo sobre toda a criação e sobre a Igreja."},
    {"id": "1-thessalonians", "slug": "1-tesalonicenses", "abbr": "1Ts", "testament": "new", "description": "Encorajamento para viver uma vida santa e ensinamentos sobre a segunda vinda de Cristo."},
    {"id": "2-thessalonians", "slug": "2-tesalonicenses", "abbr": "2Ts", "testament": "new", "description": "Esclarecimentos sobre os eventos que precedem o Dia do Senhor e exortações à firmeza."},
    {"id": "1-timothy", "slug": "1-timoteo", "abbr": "1Tm", "testament": "new", "description": "Instruções pastorais sobre o governo da igreja, a liderança e a preservação da sã doutrina."},
    {"id": "2-timothy", "slug": "2-timoteo", "abbr": "2Tm", "testament": "new", "description": "A última carta de Paulo a Timóteo, exortando-o a perseverar no ministério e a pregar a palavra."},
    {"id": "titus", "slug": "tito", "abbr": "Tt", "testament": "new", "description": "Instruções para a organização das igrejas em Creta, destacando o ensino correto e as boas obras."},
    {"id": "philemon", "slug": "filemom", "abbr": "Fm", "testament": "new", "description": "Uma carta pessoal pedindo que um servo fugitivo, Onésimo, seja acolhido como irmão em Cristo."},
    {"id": "hebrews", "slug": "hebreus", "abbr": "Hb", "testament": "new", "description": "Demonstra a superioridade de Cristo e de sua nova aliança sobre o antigo sistema sacrificial."},
    {"id": "james", "slug": "tiago", "abbr": "Tg", "testament": "new", "description": "Ensinamentos práticos mostrando que a fé verdadeira deve se manifestar em boas obras e sabedoria."},
    {"id": "1-peter", "slug": "1-pedro", "abbr": "1Pe", "testament": "new", "description": "Encorajamento aos cristãos perseguidos para permanecerem firmes na esperança e viverem em santidade."},
    {"id": "2-peter", "slug": "2-pedro", "abbr": "2Pe", "testament": "new", "description": "Alertas contra falsos mestres e exortações ao crescimento no conhecimento de Cristo."},
    {"id": "1-john", "slug": "1-joao", "abbr": "1Jo", "testament": "new", "description": "Epístola sobre a certeza da salvação, o mandamento do amor fraternal e a comunhão com Deus."},
    {"id": "2-john", "slug": "2-joao", "abbr": "2Jo", "testament": "new", "description": "Alerta contra acolher falsos mestres que negam a verdade sobre Jesus Cristo."},
    {"id": "3-john", "slug": "3-joao", "abbr": "3Jo", "testament": "new", "description": "Elogio à hospitalidade de Gayo para com os missionários e repreensão a atitudes orgulhosas."},
    {"id": "jude", "slug": "judas", "abbr": "Jd", "testament": "new", "description": "Exortação urgente para batalhar pela fé diante de falsos mestres que distorcem a graça."},
    {"id": "revelation", "slug": "apocalipse", "abbr": "Ap", "testament": "new", "description": "Visões da vitória final de Cristo sobre o mal, o julgamento final e a nova Jerusalém."}
]


def load_source_data(source: str) -> dict:
    """Load JSON from a URL or local file path."""
    if source.startswith("http://") or source.startswith("https://"):
        print(f"Fetching source from URL: {source}...")
        req = urllib.request.Request(source, headers={"User-Agent": "VeoBible/1.0"})
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content)
    else:
        path = Path(source)
        if not path.exists():
            raise RuntimeError(f"Source file not found: {path}")
        print(f"Reading local source file: {path}...")
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)


def write_json(path: Path, data: object, *, pretty: bool = False, dry_run: bool = False) -> None:
    """Write data as JSON to path with proper options."""
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    indent = 2 if pretty else None
    separators = None if pretty else (",", ":")
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=indent, separators=separators)


def process_bible(
    source_data: dict,
    output_dir: Path,
    *,
    force: bool = False,
    pretty: bool = False,
    dry_run: bool = False,
) -> None:
    """Process the getbible data and build index.json, per-book json, and per-chapter json files."""
    gb_books: list[dict] = source_data.get("books", [])
    if len(gb_books) != 66:
        raise RuntimeError(f"Expected 66 books in source data, found {len(gb_books)}")

    index_books = []
    total_chapters = 0
    total_verses = 0

    for i, meta in enumerate(BOOK_DEFINITIONS):
        gb_book = gb_books[i]
        book_id = meta["id"]
        book_name = gb_book.get("name", meta["id"].capitalize())
        chapters_list = gb_book.get("chapters", [])

        verses_per_chapter: list[int] = []
        book_dict: dict[str, list[dict]] = {}

        book_dir = output_dir / book_id

        for ch_obj in chapters_list:
            ch_num = int(ch_obj.get("chapter", len(verses_per_chapter) + 1))
            ch_verses_raw = ch_obj.get("verses", [])

            formatted_verses: list[dict] = []
            for v in ch_verses_raw:
                v_num = int(v.get("verse", len(formatted_verses) + 1))
                v_text = str(v.get("text", "")).strip()
                formatted_verses.append({"verse": v_num, "text": v_text})

            verses_per_chapter.append(len(formatted_verses))
            total_verses += len(formatted_verses)
            total_chapters += 1

            ch_str = str(ch_num)
            book_dict[ch_str] = formatted_verses

            # Write per-chapter file: {output_dir}/{book_id}/{ch_num}.json
            ch_file = book_dir / f"{ch_num}.json"
            if not dry_run and (not ch_file.exists() or force):
                write_json(ch_file, formatted_verses, pretty=pretty, dry_run=dry_run)

        # Write per-book file: {output_dir}/{book_id}.json
        book_file = output_dir / f"{book_id}.json"
        if not dry_run and (not book_file.exists() or force):
            write_json(book_file, book_dict, pretty=pretty, dry_run=dry_run)

        index_books.append(
            {
                "id": book_id,
                "name": book_name,
                "slug": meta["slug"],
                "abbr": meta["abbr"],
                "testament": meta["testament"],
                "chapters": len(chapters_list),
                "versesPerChapter": verses_per_chapter,
                "description": meta["description"],
            }
        )

    # Build index.json
    index_data = {
        "metadata": {
            "name": "Almeida Revista e Corrigida",
            "shortname": "ARC",
            "slug": "arc",
            "year": "1911",
            "language": "Portuguese",
            "copyright": "Esta Bíblia é de domínio público.",
            "description": "A Bíblia Sagrada traduzida por João Ferreira de Almeida (Almeida Revista e Corrigida - ARC). Uma das versões mais tradicionais e respeitadas na língua portuguesa.",
        },
        "books": index_books,
    }

    index_file = output_dir / "index.json"
    if not dry_run and (not index_file.exists() or force):
        write_json(index_file, index_data, pretty=pretty, dry_run=dry_run)

    print(
        f"Processing complete ({'DRY RUN' if dry_run else 'SUCCESS'}):\n"
        f"  - Target directory: {output_dir}\n"
        f"  - Books: {len(index_books)}\n"
        f"  - Chapters: {total_chapters}\n"
        f"  - Verses: {total_verses}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import Almeida (ARC) Bible from GetBible API v2 format to veobible-app structure."
    )
    parser.add_argument(
        "--source",
        default="https://api.getbible.net/v2/almeida.json",
        help="URL or path to almeida.json source (default: https://api.getbible.net/v2/almeida.json)",
    )
    parser.add_argument(
        "--output-dir",
        default="frontend/public/bible-data/pt/arc",
        help="Target output directory (default: frontend/public/bible-data/pt/arc)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Write indented JSON",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview operations without creating files",
    )

    args = parser.parse_args()

    # Calculate absolute path relative to repo root if needed
    repo_root = Path(__file__).resolve().parent.parent
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = repo_root / output_dir

    try:
        source_data = load_source_data(args.source)
        process_bible(
            source_data,
            output_dir,
            force=args.force,
            pretty=args.pretty,
            dry_run=args.dry_run,
        )
    except Exception as exc:
        print(f"Error processing Bible data: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
