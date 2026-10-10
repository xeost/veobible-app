"""Local, sequential MLX alignment worker. stdout is a JSON-lines progress channel."""
import argparse
import contextlib
import gc
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unicodedata
from headings import spoken_prefix

LANGUAGES = {"es": "Spanish", "en": "English", "pt": "Portuguese"}
MODEL = "mlx-community/Qwen3-ForcedAligner-0.6B-8bit"
ASR_MODEL = "mlx-community/Qwen3-ASR-0.6B-8bit"


def tokens(text):
    text = unicodedata.normalize("NFC", re.sub(r"\(H\d+-\d+\)", "", text))
    # Matches the space-language tokenizer used by Qwen's MLX aligner.
    return [clean for word in text.split() if (clean := "".join(
        ch for ch in word if ch == "'" or unicodedata.category(ch)[0] in "LN"))]


def validate(request):
    if request.get("language") not in LANGUAGES:
        raise ValueError("Unsupported language")
    chapters = request.get("chapters", [])
    if not 1 <= len(chapters) <= 1000:
        raise ValueError("Expected chapters")
    for chapter in chapters:
        duration = chapter.get("duration", 0)
        if not math.isfinite(duration) or duration <= 0 or not Path(chapter["audio"]).is_file():
            raise ValueError("Invalid source audio")
        previous = 0
        ids = set()
        if not chapter.get("segments"):
            raise ValueError("Expected transcript segments")
        for segment in chapter["segments"]:
            start, end = segment["start"], segment["end"]
            if (segment["id"] in ids or not tokens(segment["text"]) or
                    not all(math.isfinite(n) for n in (start, end)) or
                    start < previous - 1e-6 or end <= start or end > duration + 1e-6):
                raise ValueError("Invalid transcript segments")
            ids.add(segment["id"])
            previous = end
    return request


def word_units(chapter, prefix=()):
    result = [{"text": word, "id": None, "estimate": 0.0} for word in prefix]
    for segment in chapter["segments"]:
        words = tokens(segment["text"])
        step = (segment["end"] - segment["start"]) / len(words)
        for index, word in enumerate(words):
            result.append({"text": word, "id": segment["id"],
                           "estimate": segment["start"] + index * step})
    return result


def windows(units, duration):
    """Core windows plus overlapping transcript/audio context; never exceed 240 s."""
    if duration <= 240:
        return [(0, len(units), 0, len(units), 0.0, duration)]
    result = []
    first = 0
    while first < len(units):
        last = first + 1
        while last < len(units) and units[last]["estimate"] - units[first]["estimate"] < 100:
            last += 1
        # Keep a verse inside one core. Joining two independent predictions in
        # the middle of a sentence can produce contradictory word boundaries.
        while last < len(units) and units[last]["id"] == units[last - 1]["id"]:
            last += 1
        left, right = first, last
        while left > 0 and units[first]["estimate"] - units[left - 1]["estimate"] < 25:
            left -= 1
        while right < len(units) and units[right]["estimate"] - units[last - 1]["estimate"] < 25:
            right += 1
        start = max(0.0, units[left]["estimate"] - 10)
        end = min(duration, (units[right]["estimate"] if right < len(units) else duration) + 10)
        if end - start > 240:
            raise ValueError("Transcript density cannot be safely segmented")
        result.append((first, last, left, right, start, end))
        first = last
    return result


def detect_heading(chapter, model, language, ffmpeg):
    bible_words = [word for segment in chapter["segments"] for word in tokens(segment["text"])]
    with tempfile.TemporaryDirectory(prefix="veobible-heading-") as directory:
        wav = str(Path(directory) / "opening.wav")
        for limit in (30, 60):
            duration = min(limit, chapter["duration"])
            subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                            "-i", chapter["audio"], "-t", str(duration),
                            "-vn", "-ac", "1", "-ar", "16000", wav], check=True,
                           stdout=subprocess.DEVNULL, timeout=120)
            with contextlib.redirect_stdout(sys.stderr):
                text = model.generate(audio=wav, language=LANGUAGES[language],
                                      max_tokens=512, temperature=0.0, verbose=False).text
            prefix = spoken_prefix(tokens(text), bible_words)
            if prefix is not None:
                return prefix
            if duration >= chapter["duration"]:
                break
    # Do not save guessed boundaries when an introduction cannot be separated.
    raise ValueError("Could not locate the chapter opening in the source audio")


def align_chapter(chapter, model, language, ffmpeg, progress, prefix=()):
    units = word_units(chapter, prefix)
    chunks = windows(units, chapter["duration"])
    aligned = []
    drift = 0.0
    with tempfile.TemporaryDirectory(prefix="veobible-align-") as directory:
        wav = str(Path(directory) / "chunk.wav")
        for number, (first, last, left, right, start, end) in enumerate(chunks):
            # Carry the previous acoustic anchor forward, avoiding cumulative rate drift.
            start = max(0.0, start + drift)
            end = min(chapter["duration"], end + drift)
            if end <= start or end - start > 240:
                raise ValueError("Invalid anchored audio window")
            words = units[left:right]
            for attempt in range(2):
                subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                                "-ss", str(start), "-i", chapter["audio"], "-t", str(end - start),
                                "-vn", "-ac", "1", "-ar", "16000", wav], check=True,
                               stdout=subprocess.DEVNULL, timeout=120)
                with contextlib.redirect_stdout(sys.stderr):
                    items = list(model.generate(audio=wav, text=" ".join(w["text"] for w in words),
                                                language=LANGUAGES[language]))
                try:
                    if len(items) != len(words):
                        raise ValueError("Alignment word count mismatch")
                    previous = 0.0
                    for item, word in zip(items, words):
                        if (tokens(item.text) != [word["text"]] or
                                not all(math.isfinite(t) for t in (item.start_time, item.end_time)) or
                                item.start_time < previous - 0.08 or item.end_time < item.start_time or
                                item.end_time > end - start + 0.08):
                            raise ValueError(f"Invalid alignment timestamps in chunk {number + 1}: "
                                             f"{word['text']!r} ({item.start_time}, {item.end_time}), "
                                             f"previous={previous}, duration={end - start}")
                        previous = item.end_time
                    core = items[first - left:last - left]
                    # Reject edge-pinned chunks instead of accepting truncation.
                    if ((first > 0 and core[0].start_time < 0.5) or
                            (last < len(units) and core[-1].end_time > end - start - 0.5)):
                        raise ValueError("Alignment reached a chunk boundary; review source transcript")
                    break
                except ValueError:
                    # A speech-rate anchor can miss context in a later window.
                    # Retry with more original audio, retaining every validation.
                    expanded_start = max(0.0, start - 10)
                    expanded_end = min(chapter["duration"], end + 10)
                    if (attempt or (expanded_start == start and expanded_end == end)
                            or expanded_end - expanded_start > 240):
                        raise
                    start, end = expanded_start, expanded_end
            for index, item in enumerate(core, first):
                aligned.append({"id": units[index]["id"], "text": item.text,
                                "start": max(0, start + item.start_time),
                                "end": min(chapter["duration"], start + item.end_time)})
            drift = start + core[-1].start_time - units[last - 1]["estimate"]
            progress((number + 1) / len(chunks))
    for previous, word in zip(aligned, aligned[1:]):
        if word["start"] < previous["end"] - 0.08:
            raise ValueError(f"Overlapping alignment windows disagree: {previous['text']!r} "
                             f"ends at {previous['end']}, {word['text']!r} starts at {word['start']}")
    segments = []
    for segment in chapter["segments"]:
        words = [word for word in aligned if word["id"] == segment["id"]]
        if not words or words[-1]["end"] - words[0]["start"] < 0.08:
            raise ValueError("A transcript segment could not be aligned")
        # Qwen's quantized timestamps can collapse short function words legitimately.
        # Reject mostly collapsed segments, not ordinary sub-frame words.
        if sum(word["end"] - word["start"] <= 0 for word in words) > max(2, len(words) * 0.5):
            raise ValueError("Too many words without speech duration")
        # A long internal gap may be a spoken heading matched to a verse's first word.
        # Flag it for listening rather than reporting a calibrated confidence score.
        needs_review = (sum(word["end"] <= word["start"] for word in words) > max(1, len(words) * 0.2)
                        or any(b["start"] - a["end"] > 2.0 for a, b in zip(words, words[1:])))
        segments.append({"id": segment["id"], "words": words, "needsReview": needs_review})
    return {"index": chapter["index"], "segments": segments}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--asr-model", default=os.environ.get("VIDEO_ALIGNER_ASR_MODEL", ASR_MODEL))
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    request = validate(json.loads(Path(args.request).read_text()))
    if args.dry_run:
        print(json.dumps({"valid": True, "chapters": len(request["chapters"])}))
        return
    if sys.platform != "darwin" or os.uname().machine != "arm64":
        raise RuntimeError("MLX alignment requires Apple Silicon macOS")
    # One model per invocation; the video generation queue serializes requests.
    os.environ.setdefault("HF_HOME", str(Path(__file__).resolve().parent / ".cache" / "huggingface"))
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    import mlx.core as mx
    from mlx_audio.stt import load
    mx.set_cache_limit(256 * 1024 * 1024)
    mx.set_memory_limit(6 * 1024 * 1024 * 1024)
    print(json.dumps({"progress": 2, "stage": "loading"}), flush=True)
    with contextlib.redirect_stdout(sys.stderr):
        recognizer = load(args.asr_model)
    prefixes = []
    for index, chapter in enumerate(request["chapters"]):
        prefixes.append(detect_heading(chapter, recognizer, request["language"], args.ffmpeg))
        print(json.dumps({"progress": 3 + 17 * (index + 1) / len(request["chapters"]),
                          "stage": "detecting_headings"}), flush=True)
        mx.clear_cache()
    del recognizer
    gc.collect()
    mx.clear_cache()
    with contextlib.redirect_stdout(sys.stderr):
        model = load(args.model)
    results = []
    for index, chapter in enumerate(request["chapters"]):
        def progress(fraction):
            print(json.dumps({"progress": 20 + 75 * (index + fraction) / len(request["chapters"]),
                              "stage": "aligning"}), flush=True)
        results.append(align_chapter(chapter, model, request["language"], args.ffmpeg, progress, prefixes[index]))
        mx.clear_cache()
    output = Path(args.output)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps({"model": args.model, "chapters": results}, ensure_ascii=False))
    temporary.replace(output)
    print(json.dumps({"progress": 100, "stage": "complete"}), flush=True)


if __name__ == "__main__":
    main()
