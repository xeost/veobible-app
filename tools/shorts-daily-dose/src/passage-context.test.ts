import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "./config.js";
import { readPassageTextContext, type Passage } from "./shorts.js";

test("passage text includes two neighboring verses across chapters and handles book edges or missing context", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-passage-context-"));
  const original = config.bibleDataDir;
  const version = config.versions[0];
  const data = path.join(root, version.locale, version.id);
  const passage: Passage = { id: "john-2-1", book: "john", start: { chapter: 2, verse: 1 }, end: { chapter: 2, verse: 1 } };
  try {
    Object.assign(config, { bibleDataDir: root });
    await fs.mkdir(path.join(data, "john"), { recursive: true });
    await fs.writeFile(path.join(data, "index.json"), JSON.stringify({ metadata: { name: "Test" }, books: [{ id: "john", name: "John", chapters: 3, versesPerChapter: [2, 2, 2] }] }));
    for (let chapter = 1; chapter <= 3; chapter++) {
      await fs.writeFile(path.join(data, "john", `${chapter}.json`), JSON.stringify([1, 2].map(verse => ({ verse, text: `Text ${chapter}:${verse}` }))));
    }
    const summarize = async (selected: Passage) => (await readPassageTextContext(version, selected)).map(verse => [verse.reference, verse.inPassage]);
    assert.deepEqual(await summarize(passage), [["John 1:1", false], ["John 1:2", false], ["John 2:1", true], ["John 2:2", false], ["John 3:1", false]]);
    assert.deepEqual(await summarize({ ...passage, start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 1 } }), [["John 1:1", true], ["John 1:2", false], ["John 2:1", false]]);
    assert.deepEqual(await summarize({ ...passage, start: { chapter: 3, verse: 2 }, end: { chapter: 3, verse: 2 } }), [["John 2:2", false], ["John 3:1", false], ["John 3:2", true]]);
    assert.deepEqual(await summarize({ ...passage, start: { chapter: 1, verse: 2 }, end: { chapter: 2, verse: 1 } }), [["John 1:1", false], ["John 1:2", true], ["John 2:1", true], ["John 2:2", false], ["John 3:1", false]]);
    await fs.rm(path.join(data, "john", "1.json"));
    assert.deepEqual(await summarize(passage), [["John 2:1", true], ["John 2:2", false], ["John 3:1", false]]);
  } finally {
    Object.assign(config, { bibleDataDir: original });
    await fs.rm(root, { recursive: true, force: true });
  }
});
