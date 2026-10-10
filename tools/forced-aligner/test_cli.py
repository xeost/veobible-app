import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from cli import tokens, validate, word_units, windows, align_chapter


class AlignmentTests(unittest.TestCase):
    def test_supported_text_normalization(self):
        self.assertEqual(tokens("Así (H1-2) creó Dios."), ["Así", "creó", "Dios"])
        self.assertEqual(tokens("Don't fear; God's here."), ["Don't", "fear", "God's", "here"])
        self.assertEqual(tokens("No princípio, Deus criou."), ["No", "princípio", "Deus", "criou"])
        self.assertEqual(tokens("ce\u0301u"), ["céu"])

    def test_long_windows_cover_every_word_once_with_context(self):
        chapter = {"duration": 1200, "segments": [
            {"id": str(i), "text": "one two three four five", "start": i * 10, "end": (i + 1) * 10}
            for i in range(120)]}
        units = word_units(chapter)
        chunks = windows(units, chapter["duration"])
        self.assertGreater(len(chunks), 1)
        covered = []
        for first, last, left, right, start, end in chunks:
            self.assertLessEqual(end - start, 240)
            self.assertLessEqual(left, first)
            self.assertGreaterEqual(right, last)
            covered.extend(range(first, last))
        self.assertEqual(covered, list(range(len(units))))

    def test_model_times_mapped_to_segment_ids(self):
        chapter = {"index": 2, "audio": "audio.mp3", "duration": 10, "segments": [
            {"id": "a", "text": "First verse", "start": 0, "end": 5},
            {"id": "b", "text": "Second verse", "start": 5, "end": 10}]}
        model = SimpleNamespace(generate=lambda **kwargs: [
            SimpleNamespace(text=word, start_time=i * 2 + 0.2, end_time=i * 2 + 1)
            for i, word in enumerate(kwargs["text"].split())])
        with patch("cli.subprocess.run"):
            output = align_chapter(chapter, model, "en", "ffmpeg", lambda value: None)
        self.assertEqual(output["index"], 2)
        self.assertEqual(output["segments"][1]["words"][0]["start"], 4.2)
        self.assertEqual(output["segments"][1]["id"], "b")
        model.generate = lambda **kwargs: [SimpleNamespace(text="wrong", start_time=0, end_time=1)]
        with patch("cli.subprocess.run"), self.assertRaisesRegex(ValueError, "word count"):
            align_chapter(chapter, model, "en", "ffmpeg", lambda value: None)

    def test_short_collapsed_words_are_reviewable_but_empty_segments_fail(self):
        chapter = {"index": 0, "audio": "audio.mp3", "duration": 10, "segments": [
            {"id": "a", "text": "Praise the Lord for his mercy", "start": 0, "end": 10}]}
        def generate(**kwargs):
            return [SimpleNamespace(text=word, start_time=i, end_time=i + (0 if i in (1, 3, 4) else 0.8))
                    for i, word in enumerate(kwargs["text"].split())]
        with patch("cli.subprocess.run"):
            result = align_chapter(chapter, SimpleNamespace(generate=generate), "en", "ffmpeg", lambda value: None)
        self.assertTrue(result["segments"][0]["needsReview"])
        def collapsed(**kwargs):
            return [SimpleNamespace(text=word, start_time=0, end_time=0) for word in kwargs["text"].split()]
        with patch("cli.subprocess.run"), self.assertRaisesRegex(ValueError, "could not be aligned"):
            align_chapter(chapter, SimpleNamespace(generate=collapsed), "en", "ffmpeg", lambda value: None)

    def test_invalid_transcripts_rejected_before_model_load(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = Path(directory) / "test.wav"
            audio.touch()
            request = {"language": "pt", "chapters": [{"audio": str(audio), "duration": 10,
                       "segments": [{"id": "one", "text": "Deus", "start": 0, "end": 11}]}]}
            with self.assertRaises(ValueError):
                validate(request)
            request["chapters"][0]["segments"][0]["end"] = 10
            self.assertEqual(validate(request), request)
            request["language"] = "xx"
            with self.assertRaises(ValueError):
                validate(request)


if __name__ == "__main__":
    unittest.main()
