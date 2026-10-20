"""Bound each synthesis call well below Chatterbox's 1,000 speech-token limit."""
import re


def speech_chunks(text: str, max_chars: int = 220, max_words: int = 35) -> list[str]:
    chunks = []
    # Keep verse and sentence boundaries where possible, without adding or dropping words.
    for line in text.splitlines():
        current = ""
        for sentence in re.split(r"(?<=[.!?;:])\s+", line.strip()):
            sentence = " ".join(sentence.split())
            if not sentence:
                continue
            candidate = f"{current} {sentence}".strip()
            if len(candidate) <= max_chars and len(candidate.split()) <= max_words:
                current = candidate
                continue
            if current:
                chunks.append(current)
                current = ""
            for word in sentence.split():
                candidate = f"{current} {word}".strip()
                if current and (len(candidate) > max_chars or len(candidate.split()) > max_words):
                    chunks.append(current)
                    current = word
                else:
                    current = candidate
        if current:
            chunks.append(current)
    return chunks
