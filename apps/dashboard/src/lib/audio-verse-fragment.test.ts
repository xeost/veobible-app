import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audioVerseFragment,
  parseAudioVerseFragment,
} from "./audio-verse-fragment";

test("audio verse links restore the chapter and verse within the current book", () => {
  const counts = [31, 25, 24];
  assert.equal(audioVerseFragment({ chapter: 1, verse: 10 }), "#1-10");
  for (const selection of [
    { chapter: 1, verse: 1 },
    { chapter: 2, verse: 25 },
    { chapter: 3, verse: 12 },
  ]) {
    assert.deepEqual(
      parseAudioVerseFragment(audioVerseFragment(selection), counts),
      selection,
    );
  }
});

test("legacy explicit verse links remain readable", () => {
  assert.deepEqual(parseAudioVerseFragment("#verse-1-10", [31]), {
    chapter: 1,
    verse: 10,
  });
});

test("invalid or out-of-book fragments do not select an unavailable verse", () => {
  for (const fragment of [
    "",
    "#chapter-1",
    "#0-1",
    "#1-0",
    "#4-1",
    "#2-26",
    "#verse-0-1",
    "#verse-1-0",
    "#verse-4-1",
    "#verse-2-26",
    "#verse-1-1.5",
    "#verse-01-2",
    "#verse-1-2-extra",
    "#verse-9007199254740992-1",
    "#verse-1-9007199254740992",
  ]) {
    assert.equal(
      parseAudioVerseFragment(fragment, [31, 25, 24]),
      null,
      fragment,
    );
  }
  assert.equal(parseAudioVerseFragment("#verse-1-1", []), null);
});
