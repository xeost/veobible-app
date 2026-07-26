#!/usr/bin/env python3
"""
import-getbible-web.py
======================
Downloads or reads the World English Bible (WEB) JSON from GetBible API v2
(https://api.getbible.net/v2/web.json) and converts it to the veobible-app
storage structure under `frontend/public/bible-data/en/web`.

Output structure
----------------
frontend/public/bible-data/en/web/
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
    python3 scripts/import-getbible-web.py

Options
-------
    --source SOURCE   URL or local file path to web.json
                      (default: https://api.getbible.net/v2/web.json)
    --output-dir DIR  Destination directory
                      (default: frontend/public/bible-data/en/web)
    --force           Overwrite existing files without warning
    --pretty          Write indented JSON for debugging
    --dry-run         Preview actions without writing files
    --help            Show this message and exit
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

# Canonical 66 Bible books with English metadata
BOOK_DEFINITIONS = [
    {"id": "genesis", "name": "Genesis", "slug": "genesis", "abbr": "Gen", "testament": "old", "description": "The book of beginnings, narrating the creation of the world, the fall of man, and the origins of the nation of Israel."},
    {"id": "exodus", "name": "Exodus", "slug": "exodus", "abbr": "Exod", "testament": "old", "description": "The liberation of the people of Israel from slavery in Egypt under Moses' leadership and the giving of the Law at Mount Sinai."},
    {"id": "leviticus", "name": "Leviticus", "slug": "leviticus", "abbr": "Lev", "testament": "old", "description": "A manual of laws and regulations for the priesthood and the people of Israel, emphasizing the holiness of God."},
    {"id": "numbers", "name": "Numbers", "slug": "numbers", "abbr": "Num", "testament": "old", "description": "Recounts the forty-year journey of the Israelites through the wilderness and God's faithfulness throughout."},
    {"id": "deuteronomy", "name": "Deuteronomy", "slug": "deuteronomy", "abbr": "Deut", "testament": "old", "description": "Moses' restatement of the Law before Israel enters the Promised Land, calling the people to obedience and love for God."},
    {"id": "joshua", "name": "Joshua", "slug": "joshua", "abbr": "Josh", "testament": "old", "description": "The conquest of Canaan led by Joshua and the division of the land among the tribes of Israel."},
    {"id": "judges", "name": "Judges", "slug": "judges", "abbr": "Judg", "testament": "old", "description": "The history of Israel's leaders and deliverers during a period of cycles of sin, oppression, and liberation."},
    {"id": "ruth", "name": "Ruth", "slug": "ruth", "abbr": "Ruth", "testament": "old", "description": "A moving story of loyalty, faith, and redemption in the lives of Ruth and Boaz, ancestors of King David."},
    {"id": "1-samuel", "name": "1 Samuel", "slug": "1-samuel", "abbr": "1Sam", "testament": "old", "description": "Israel's transition from judges to monarchy, featuring the stories of Samuel, Saul, and David."},
    {"id": "2-samuel", "name": "2 Samuel", "slug": "2-samuel", "abbr": "2Sam", "testament": "old", "description": "King David's reign over Israel, his victories, his failures, and God's covenant with his dynasty."},
    {"id": "1-kings", "name": "1 Kings", "slug": "1-kings", "abbr": "1Kgs", "testament": "old", "description": "Solomon's reign, the construction of the Temple, and the subsequent division of the kingdom into Israel and Judah."},
    {"id": "2-kings", "name": "2 Kings", "slug": "2-kings", "abbr": "2Kgs", "testament": "old", "description": "The decline and fall of the divided kingdoms of Israel and Judah, culminating in the Babylonian exile."},
    {"id": "1-chronicles", "name": "1 Chronicles", "slug": "1-chronicles", "abbr": "1Chr", "testament": "old", "description": "Sacred genealogies and a detailed account of David's reign, focusing on worship and the Temple."},
    {"id": "2-chronicles", "name": "2 Chronicles", "slug": "2-chronicles", "abbr": "2Chr", "testament": "old", "description": "Solomon's reign, the construction of the Temple, and the history of Judah's kings until the exile."},
    {"id": "ezra", "name": "Ezra", "slug": "ezra", "abbr": "Ezra", "testament": "old", "description": "The return of Jewish exiles from Babylon to Jerusalem and the rebuilding of the Temple under Ezra's leadership."},
    {"id": "nehemiah", "name": "Nehemiah", "slug": "nehemiah", "abbr": "Neh", "testament": "old", "description": "Nehemiah's rebuilding of the walls of Jerusalem and the spiritual renewal of the people."},
    {"id": "esther", "name": "Esther", "slug": "esther", "abbr": "Esth", "testament": "old", "description": "How Queen Esther and her uncle Mordecai saved the Jewish people from destruction in the Persian Empire."},
    {"id": "job", "name": "Job", "slug": "job", "abbr": "Job", "testament": "old", "description": "A profound reflection on the suffering of the righteous, God's sovereignty, and faith in the face of trial."},
    {"id": "psalms", "name": "Psalms", "slug": "psalms", "abbr": "Ps", "testament": "old", "description": "A collection of inspired prayers, praises, and poems covering the full range of human experience with God."},
    {"id": "proverbs", "name": "Proverbs", "slug": "proverbs", "abbr": "Prov", "testament": "old", "description": "Practical wisdom for daily life rooted in the fear of the Lord, covering relationships, work, and integrity."},
    {"id": "ecclesiastes", "name": "Ecclesiastes", "slug": "ecclesiastes", "abbr": "Eccl", "testament": "old", "description": "A search for meaning under the sun, concluding that fearing God is the supreme duty of mankind."},
    {"id": "song-of-solomon", "name": "Song of Solomon", "slug": "song-of-solomon", "abbr": "Song", "testament": "old", "description": "A love poem celebrating the beauty of marital love and the relationship between God and his people."},
    {"id": "isaiah", "name": "Isaiah", "slug": "isaiah", "abbr": "Isa", "testament": "old", "description": "Prophecies of judgment on Israel and the nations, the promise of the Suffering Servant Messiah, and future glory."},
    {"id": "jeremiah", "name": "Jeremiah", "slug": "jeremiah", "abbr": "Jer", "testament": "old", "description": "The weeping prophet's warnings of Jerusalem's imminent destruction and the promise of a new covenant."},
    {"id": "lamentations", "name": "Lamentations", "slug": "lamentations", "abbr": "Lam", "testament": "old", "description": "Poems of grief and mourning over the destruction of Jerusalem and the Temple, reaffirming God's faithfulness."},
    {"id": "ezekiel", "name": "Ezekiel", "slug": "ezekiel", "abbr": "Ezek", "testament": "old", "description": "Dramatic prophetic visions of God's glory, the judgment of Judah, and the future restoration of the Temple and people."},
    {"id": "daniel", "name": "Daniel", "slug": "daniel", "abbr": "Dan", "testament": "old", "description": "Stories of faithfulness to God in Babylonian exile and apocalyptic visions of God's eternal kingdom."},
    {"id": "hosea", "name": "Hosea", "slug": "hosea", "abbr": "Hos", "testament": "old", "description": "Hosea's prophetic marriage symbolizing God's unconditional love for his unfaithful people."},
    {"id": "joel", "name": "Joel", "slug": "joel", "abbr": "Joel", "testament": "old", "description": "A locust plague as a warning of the Day of the Lord and the promise of the outpouring of God's Spirit."},
    {"id": "amos", "name": "Amos", "slug": "amos", "abbr": "Amos", "testament": "old", "description": "A call to social justice and sincere repentance directed at the northern kingdom of Israel."},
    {"id": "obadiah", "name": "Obadiah", "slug": "obadiah", "abbr": "Obad", "testament": "old", "description": "A prophecy of judgment against Edom for its pride and violence against its brother Jacob."},
    {"id": "jonah", "name": "Jonah", "slug": "jonah", "abbr": "Jonah", "testament": "old", "description": "The prophet Jonah's reluctance to preach to Nineveh and God's universal compassion for the nations."},
    {"id": "micah", "name": "Micah", "slug": "micah", "abbr": "Mic", "testament": "old", "description": "Denunciation of leaders' injustice and the promise of a Ruler born in Bethlehem who will bring peace."},
    {"id": "nahum", "name": "Nahum", "slug": "nahum", "abbr": "Nah", "testament": "old", "description": "A declaration of God's judgment on the Assyrian empire and the destruction of the city of Nineveh."},
    {"id": "habakkuk", "name": "Habakkuk", "slug": "habakkuk", "abbr": "Hab", "testament": "old", "description": "An honest dialogue between the prophet and God about divine justice, concluding with a triumphant declaration of faith."},
    {"id": "zephaniah", "name": "Zephaniah", "slug": "zephaniah", "abbr": "Zeph", "testament": "old", "description": "The imminence of the Day of the Lord, the purification of a humble remnant, and the promise of restoration."},
    {"id": "haggai", "name": "Haggai", "slug": "haggai", "abbr": "Hag", "testament": "old", "description": "Exhortations to the people returning from exile to prioritize the rebuilding of the House of God."},
    {"id": "zechariah", "name": "Zechariah", "slug": "zechariah", "abbr": "Zech", "testament": "old", "description": "Encouraging prophetic visions about the restoration of Jerusalem and messianic prophecies about the coming King."},
    {"id": "malachi", "name": "Malachi", "slug": "malachi", "abbr": "Mal", "testament": "old", "description": "The last prophet of the Old Testament rebukes religious apathy and announces the coming of the Lord's messenger."},
    {"id": "matthew", "name": "Matthew", "slug": "matthew", "abbr": "Matt", "testament": "new", "description": "The Gospel written to demonstrate that Jesus is the Messiah promised in the Old Testament and the King of the Jews."},
    {"id": "mark", "name": "Mark", "slug": "mark", "abbr": "Mark", "testament": "new", "description": "A dynamic, action-focused account portraying Jesus as the Suffering Servant and Son of God."},
    {"id": "luke", "name": "Luke", "slug": "luke", "abbr": "Luke", "testament": "new", "description": "A meticulous historical account of the Gospel emphasizing Jesus' compassion for all who are in need."},
    {"id": "john", "name": "John", "slug": "john", "abbr": "John", "testament": "new", "description": "A profound Gospel focused on the divinity of Jesus Christ, the incarnate Word who grants eternal life."},
    {"id": "acts", "name": "Acts", "slug": "acts", "abbr": "Acts", "testament": "new", "description": "The story of the birth of the Church and the spread of the Gospel by the power of the Holy Spirit from Jerusalem to Rome."},
    {"id": "romans", "name": "Romans", "slug": "romans", "abbr": "Rom", "testament": "new", "description": "A systematic exposition of the gospel, explaining justification by faith, grace, and life in the Spirit."},
    {"id": "1-corinthians", "name": "1 Corinthians", "slug": "1-corinthians", "abbr": "1Cor", "testament": "new", "description": "A letter addressing divisions in the church, Christian ethics, spiritual gifts, and the truth of the resurrection."},
    {"id": "2-corinthians", "name": "2 Corinthians", "slug": "2-corinthians", "abbr": "2Cor", "testament": "new", "description": "A passionate defense of Paul's apostolic ministry, emphasizing God's grace in human weakness."},
    {"id": "galatians", "name": "Galatians", "slug": "galatians", "abbr": "Gal", "testament": "new", "description": "A defense of Christian freedom and justification by faith alone, against legalism."},
    {"id": "ephesians", "name": "Ephesians", "slug": "ephesians", "abbr": "Eph", "testament": "new", "description": "Explores spiritual blessings in Christ, the unity of the Church, and the armor of God."},
    {"id": "philippians", "name": "Philippians", "slug": "philippians", "abbr": "Phil", "testament": "new", "description": "A letter full of joy and gratitude, encouraging humility, unity, and confidence in Christ."},
    {"id": "colossians", "name": "Colossians", "slug": "colossians", "abbr": "Col", "testament": "new", "description": "Highlights the supremacy and sufficiency of Christ over all creation and over the Church."},
    {"id": "1-thessalonians", "name": "1 Thessalonians", "slug": "1-thessalonians", "abbr": "1Thess", "testament": "new", "description": "Encouragement to live a holy life and teachings about the second coming of Christ."},
    {"id": "2-thessalonians", "name": "2 Thessalonians", "slug": "2-thessalonians", "abbr": "2Thess", "testament": "new", "description": "Clarifications about events preceding the Day of the Lord and exhortations to steadfastness."},
    {"id": "1-timothy", "name": "1 Timothy", "slug": "1-timothy", "abbr": "1Tim", "testament": "new", "description": "Pastoral instructions on church governance, leadership, and the preservation of sound doctrine."},
    {"id": "2-timothy", "name": "2 Timothy", "slug": "2-timothy", "abbr": "2Tim", "testament": "new", "description": "Paul's final letter to Timothy, urging him to persevere in ministry and to preach the word."},
    {"id": "titus", "name": "Titus", "slug": "titus", "abbr": "Titus", "testament": "new", "description": "Instructions for organizing churches in Crete, emphasizing correct teaching and good works."},
    {"id": "philemon", "name": "Philemon", "slug": "philemon", "abbr": "Phlm", "testament": "new", "description": "A personal letter asking that a runaway servant, Onesimus, be received back as a brother in Christ."},
    {"id": "hebrews", "name": "Hebrews", "slug": "hebrews", "abbr": "Heb", "testament": "new", "description": "Demonstrates the superiority of Christ and his new covenant over the old sacrificial system."},
    {"id": "james", "name": "James", "slug": "james", "abbr": "Jas", "testament": "new", "description": "Practical teachings showing that genuine faith must manifest itself in good works and wisdom."},
    {"id": "1-peter", "name": "1 Peter", "slug": "1-peter", "abbr": "1Pet", "testament": "new", "description": "Encouragement to persecuted Christians to remain firm in hope and to live in holiness."},
    {"id": "2-peter", "name": "2 Peter", "slug": "2-peter", "abbr": "2Pet", "testament": "new", "description": "Warnings against false teachers and exhortations to grow in the knowledge of Christ."},
    {"id": "1-john", "name": "1 John", "slug": "1-john", "abbr": "1John", "testament": "new", "description": "An epistle about assurance of salvation, the commandment of brotherly love, and fellowship with God."},
    {"id": "2-john", "name": "2 John", "slug": "2-john", "abbr": "2John", "testament": "new", "description": "A warning against welcoming false teachers who deny the truth about Jesus Christ."},
    {"id": "3-john", "name": "3 John", "slug": "3-john", "abbr": "3John", "testament": "new", "description": "Commendation of Gaius' hospitality toward missionaries and a rebuke of prideful attitudes."},
    {"id": "jude", "name": "Jude", "slug": "jude", "abbr": "Jude", "testament": "new", "description": "An urgent exhortation to contend for the faith against false teachers who distort grace."},
    {"id": "revelation", "name": "Revelation", "slug": "revelation", "abbr": "Rev", "testament": "new", "description": "Visions of Christ's final victory over evil, the final judgment, and the new Jerusalem."},
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
        book_name = meta.get("name", gb_book.get("name", meta["id"].capitalize()))
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
            "name": "World English Bible",
            "shortname": "WEB",
            "slug": "web",
            "year": "2000",
            "language": "English",
            "copyright": "This Bible is in the public domain.",
            "description": (
                "The World English Bible (WEB) is a public domain modern English translation "
                "of the Holy Bible, based on the American Standard Version (1901). It uses "
                "modern English vocabulary and grammar while remaining faithful to the original texts."
            ),
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
        description="Import World English Bible (WEB) from GetBible API v2 format to veobible-app structure."
    )
    parser.add_argument(
        "--source",
        default="https://api.getbible.net/v2/web.json",
        help="URL or path to web.json source (default: https://api.getbible.net/v2/web.json)",
    )
    parser.add_argument(
        "--output-dir",
        default="frontend/public/bible-data/en/web",
        help="Target output directory (default: frontend/public/bible-data/en/web)",
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
