import { test } from "node:test";
import assert from "node:assert/strict";
import { audioSpeechBlocks } from "./audio-speech-blocks.js";
test("speech blocks retain order and never span chapters, missing verses or the word budget", () => {
  const verses = [1, 2, 3, 5].map((verse) => ({
    chapter: 1,
    verse,
    text: "one two three",
  }));
  verses.push({ chapter: 2, verse: 1, text: "another chapter" });
  const blocks = audioSpeechBlocks(verses, 6);
  assert.deepEqual(
    blocks.map((block) => block.map((v) => `${v.chapter}:${v.verse}`)),
    [["1:1", "1:2"], ["1:3"], ["1:5"], ["2:1"]],
  );
  assert.deepEqual(blocks.flat(), verses);
});
