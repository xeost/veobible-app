"""Identify spoken introductory text without replacing the Bible transcript."""
from difflib import SequenceMatcher
import unicodedata


def normalized(word):
    return "".join(ch for ch in unicodedata.normalize("NFKD", word.casefold())
                   if ch.isalnum())


def spoken_prefix(transcript_words, bible_words):
    """Return only words before a reliable match of the chapter's opening.

    Accent/case differences and small ASR spelling errors (Adam/Adán) are
    tolerated. We never use the recognized verse text as the alignment text.
    None means the opening could not be located; [] means there is no heading.
    """
    actual = [normalized(word) for word in transcript_words]
    expected = [normalized(word) for word in bible_words[:8]]
    if len(expected) < 4:
        return None
    candidates = []
    # ASR occasionally omits a short opening conjunction. The aligner still
    # receives that word from the original Bible text.
    skips = [0, 1] if expected[0] in {"y", "e", "and", "o", "a"} else [0]
    for skip in skips:
        anchor = expected[skip:]
        for start in range(min(80, len(actual))):
            if actual[start] != anchor[0] and not (
                    len(anchor[0]) >= 4 and
                    SequenceMatcher(None, actual[start], anchor[0], autojunk=False).ratio() >= 0.8):
                continue
            for size in range(max(4, len(anchor) - 1), len(anchor) + 2):
                sample = actual[start:start + size]
                if len(sample) < 4:
                    continue
                # Both word and character similarity avoid matching isolated
                # common words in a title, while tolerating one misspelled name.
                canonical = []
                for word in sample:
                    similarity, closest = max(
                        (SequenceMatcher(None, word, known, autojunk=False).ratio(), known)
                        for known in anchor)
                    canonical.append(closest if similarity >= 0.8 else word)
                exact = SequenceMatcher(None, anchor, canonical, autojunk=False).ratio()
                spelling = SequenceMatcher(None, " ".join(anchor), " ".join(sample),
                                           autojunk=False).ratio()
                if exact >= 0.65 and spelling >= 0.82:
                    candidates.append((spelling - skip * 0.04, -start, start))
    if not candidates:
        return None
    start = max(candidates)[2]
    # Never swallow an opening conjunction when ASR recognized it separately.
    if start and actual[start - 1] == expected[0] and 1 in skips:
        start -= 1
    return transcript_words[:start]
