import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from cli import tokens, validate, word_units, windows, align_chapter, detect_heading
from headings import spoken_prefix


class AlignmentTests(unittest.TestCase):
    def test_spoken_headings_and_numbers_are_separate_from_bible_text(self):
        examples = [
            ("Capítulo 4. Y conoció Adán a su mujer Eva la cual concibió",
             "Y Conocio Adam á su mujer Eva la cual concibió", "Capítulo 4"),
            ("Capítulo cinco. Este es el libro de las generaciones de Adán",
             "Este es el libro de las generaciones de Adam", "Capítulo cinco"),
            ("Libro según San Juan. Capítulo uno. En el principio era el Verbo y el Verbo",
             "En el principio era el Verbo y el Verbo", "Libro según San Juan Capítulo uno"),
            ("Chapter four. And Adam knew Eve his wife and she conceived",
             "And Adam knew Eve his wife and she conceived", "Chapter four"),
            ("Evangelho segundo São João. Capítulo um. No princípio era o Verbo e o Verbo",
             "No princípio era o Verbo e o Verbo", "Evangelho segundo São João Capítulo um"),
            ("Salmo cento e dezessete Louvai o Senhor todas as nações Louvai o todos os povos",
             "Louvae ao Senhor todas as nações louvae-o todos os povos", "Salmo cento e dezessete"),
        ]
        for recognized, bible, heading in examples:
            with self.subTest(recognized=recognized):
                self.assertEqual(spoken_prefix(tokens(recognized), tokens(bible)), tokens(heading))
        self.assertEqual(spoken_prefix(tokens(examples[0][1]), tokens(examples[0][1])), [])
        self.assertEqual(spoken_prefix(tokens("Capítulo cuatro. Conoció Adán a su mujer Eva la cual concibió"),
                                       tokens(examples[0][1])), tokens("Capítulo cuatro"))
        self.assertEqual(spoken_prefix(tokens("Y conoció Adán a su mujer Eva la cual concibió"),
                                       tokens(examples[0][1])), [])
        self.assertIsNone(spoken_prefix(tokens("Capítulo cuatro música instrumental"), tokens(examples[0][1])))

    def test_heading_detection_retries_long_intro_without_guessing(self):
        chapter = {"audio": "audio.mp3", "duration": 80, "segments": [
            {"text": "En el principio era el Verbo y el Verbo"}]}
        model = SimpleNamespace(generate=lambda **kwargs: SimpleNamespace(text="Libro según San Juan"))
        with patch("cli.subprocess.run") as convert, self.assertRaisesRegex(ValueError, "chapter opening"):
            detect_heading(chapter, model, "es", "ffmpeg")
        self.assertEqual(convert.call_count, 2)

    def test_alignment_discards_heading_words_and_keeps_source_coordinates(self):
        chapter = {"index": 0, "audio": "audio.mp3", "duration": 20, "segments": [
            {"id": "verse1", "text": "Y conoció Adam a su mujer Eva", "start": 0, "end": 20}]}
        def generate(**kwargs):
            self.assertTrue(kwargs["text"].startswith("Capítulo cuatro Y conoció"))
            return [SimpleNamespace(text=word, start_time=i + 0.1, end_time=i + 0.8)
                    for i, word in enumerate(kwargs["text"].split())]
        with patch("cli.subprocess.run"):
            result = align_chapter(chapter, SimpleNamespace(generate=generate), "es", "ffmpeg",
                                   lambda value: None, tokens("Capítulo cuatro"))
        self.assertEqual(len(result["segments"]), 1)
        first = result["segments"][0]["words"][0]
        self.assertEqual((first["id"], first["text"], first["start"]), ("verse1", "Y", 2.1))

    def test_supported_text_normalization(self):
        self.assertEqual(tokens("Así (H1-2) creó Dios."), ["Así", "creó", "Dios"])
        self.assertEqual(tokens("Don't fear; God's here."), ["Don't", "fear", "God's", "here"])
        self.assertEqual(tokens("No princípio, Deus criou."), ["No", "princípio", "Deus", "criou"])
        self.assertEqual(tokens("ce\u0301u"), ["céu"])

    def test_long_windows_cover_every_word_once_with_context(self):
        chapter = {"duration": 1320, "segments": [
            {"id": str(i), "text": "one two three four five", "start": i * 11, "end": (i + 1) * 11}
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
            if last < len(units):
                self.assertNotEqual(units[last - 1]["id"], units[last]["id"])
        self.assertEqual(covered, list(range(len(units))))
        headed = word_units(chapter, tokens("Chapter one"))
        self.assertEqual([unit["id"] for unit in headed[:2]], [None, None])
        headed_chunks = windows(headed, chapter["duration"])
        self.assertEqual(headed_chunks[0][0], 0)
        self.assertEqual(headed_chunks[-1][1], len(headed))

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

    def test_invalid_window_retries_more_audio_without_relaxing_validation(self):
        chapter = {"index": 0, "audio": "audio.mp3", "duration": 320, "segments": [
            {"id": str(i), "text": " ".join(f"w{n}" for n in range(i * 5, (i + 1) * 5)),
             "start": i * 5, "end": (i + 1) * 5} for i in range(64)]}
        converted = []
        calls = 0
        def convert(args, **kwargs):
            converted.append((float(args[args.index("-ss") + 1]), float(args[args.index("-t") + 1])))
        def generate(**kwargs):
            nonlocal calls
            calls += 1
            start, duration = converted[-1]
            result = [SimpleNamespace(text=word, start_time=int(word[1:]) + 0.2 - start,
                                      end_time=int(word[1:]) + 0.8 - start)
                      for word in kwargs["text"].split()]
            if calls == 1:
                result[-1].end_time = duration + 1
            return result
        with patch("cli.subprocess.run", side_effect=convert):
            output = align_chapter(chapter, SimpleNamespace(generate=generate), "en", "ffmpeg", lambda value: None)
        self.assertEqual(converted[1][1], converted[0][1] + 10)
        self.assertEqual(output["segments"][0]["words"][0]["start"], 0.2)
        self.assertEqual(output["segments"][-1]["words"][-1]["end"], 319.8)


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
