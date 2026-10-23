import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audioVerseFragment,
  parseAudioVerseFragment,
  rememberAudioVerseSelection,
  restoreAudioVerseSelection,
  audioVerseStorageKey,
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

test("old verse links and remembered positions remain readable", () => {
  assert.deepEqual(parseAudioVerseFragment("#verse-1-10", [31]), {
    chapter: 1,
    verse: 10,
  });
  assert.deepEqual(
    restoreAudioVerseSelection("rv1909-v2", "genesis", "", [31], {
      getItem: () => "#verse-1-10",
    }),
    { chapter: 1, verse: 10 },
  );
});

test("last selections persist per edition and book, and explicit verse links take priority", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const counts = [31, 25];
  rememberAudioVerseSelection(
    "rv1909-v2",
    "genesis",
    { chapter: 2, verse: 7 },
    storage,
  );
  rememberAudioVerseSelection(
    "rv1909-v3",
    "genesis",
    { chapter: 1, verse: 3 },
    storage,
  );
  rememberAudioVerseSelection(
    "rv1909-v2",
    "exodus",
    { chapter: 1, verse: 8 },
    storage,
  );
  assert.deepEqual(
    restoreAudioVerseSelection("rv1909-v2", "genesis", "", counts, storage),
    { chapter: 2, verse: 7 },
  );
  assert.deepEqual(
    restoreAudioVerseSelection("rv1909-v3", "genesis", "", counts, storage),
    { chapter: 1, verse: 3 },
  );
  assert.deepEqual(
    restoreAudioVerseSelection("rv1909-v2", "exodus", "", counts, storage),
    { chapter: 1, verse: 8 },
  );
  assert.deepEqual(
    restoreAudioVerseSelection(
      "rv1909-v2",
      "genesis",
      "#verse-1-2",
      counts,
      storage,
    ),
    { chapter: 1, verse: 2 },
  );
  assert.equal(
    restoreAudioVerseSelection("rv1909-v4", "genesis", "", counts, storage),
    null,
  );
  values.set(audioVerseStorageKey("rv1909-v2", "genesis"), "#verse-3-1");
  assert.equal(
    restoreAudioVerseSelection("rv1909-v2", "genesis", "", counts, storage),
    null,
  );
});

test("blocked storage does not prevent verse navigation or opening explicit links", () => {
  const blocked = {
    getItem: () => {
      throw new Error("Storage unavailable");
    },
    setItem: () => {
      throw new Error("Storage unavailable");
    },
  };
  assert.doesNotThrow(() =>
    rememberAudioVerseSelection(
      "rv1909-v2",
      "genesis",
      { chapter: 1, verse: 2 },
      blocked,
    ),
  );
  assert.equal(
    restoreAudioVerseSelection("rv1909-v2", "genesis", "", [31], blocked),
    null,
  );
  assert.deepEqual(
    restoreAudioVerseSelection(
      "rv1909-v2",
      "genesis",
      "#verse-1-2",
      [31],
      blocked,
    ),
    { chapter: 1, verse: 2 },
  );
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
