import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "./config.js";
import { loadCatalog, passageChapters, reference, analyzePassageAudio, readPassageTextContext, type Passage } from "./episodes.js";
import { spokenReference } from "./voice.js";
import { estimateVerseCues } from "./verse-timing.js";

test("the 365-day catalog preserves episode IDs and cross-book endpoints", async () => {
  const catalog = await loadCatalog();
  assert.equal(catalog.length, 365);
  assert.equal(new Set(catalog.map(episode => episode.id)).size, 365);
  assert.equal(catalog[0].id, "episode-001");
  assert.equal(catalog.at(-1)!.id, "episode-365");
  assert.equal(catalog.filter(episode => episode.book !== episode.endBook).length, 40);
  assert.equal(catalog[32].book, "exodus");
  assert.equal(catalog[32].endBook, "leviticus");
});

test("cross-book episodes concatenate all chapters, keep references distinct and show neighboring context", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-episode-test-"));
  const original = { bibleDataDir: config.bibleDataDir, audioDir: config.audioDir };
  const version = config.versions[0];
  const index = { metadata: { name: "Test" }, books: [
    { id: "genesis", name: "Genesis", chapters: 2, versesPerChapter: [4, 4] },
    { id: "exodus", name: "Exodus", chapters: 1, versesPerChapter: [4] }
  ] };
  const episode: Passage = { id: "episode-033", episode: 33, book: "genesis", endBook: "exodus", start: { chapter: 1, verse: 3 }, end: { chapter: 1, verse: 2 } };
  try {
    Object.assign(config, { bibleDataDir: path.join(root, "bible"), audioDir: path.join(root, "audio") });
    const data = path.join(config.bibleDataDir, version.locale, version.id);
    await fs.mkdir(data, { recursive: true });
    await fs.mkdir(path.join(config.audioDir, version.id), { recursive: true });
    await fs.writeFile(path.join(data, "index.json"), JSON.stringify(index));
    for (const [number, book] of index.books.entries()) {
      await fs.mkdir(path.join(data, book.id));
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        await fs.writeFile(path.join(data, book.id, `${chapter}.json`), JSON.stringify([1, 2, 3, 4].map(verse => ({ verse, text: "One two three four" }))));
        execFileSync(config.ffmpegBin, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=600:duration=2", "-y", path.join(config.audioDir, version.id, `${String(number + 1).padStart(2, "0")}-${book.id}-${chapter}.mp3`)]);
      }
    }
    const ranges = passageChapters(index, episode);
    assert.deepEqual(ranges.map(range => [range.book.id, range.chapter, range.first, range.last]), [["genesis", 1, 3, 4], ["genesis", 2, 1, 4], ["exodus", 1, 1, 2]]);
    assert.equal(reference("Genesis", episode), "Genesis 1:3 – Exodus 1:2");
    for (const locale of ["es", "en", "pt"] as const) {
      assert.ok(spokenReference(locale, "Genesis", episode).includes("Exodus"));
      assert.ok(!/\d/.test(spokenReference(locale, "Genesis", episode)));
    }
    const analysis = await analyzePassageAudio(version, episode);
    assert.equal(analysis.sections.length, 3);
    assert.ok(analysis.lines[0].startsWith("Genesis 1:3"));
    assert.ok(analysis.lines.at(-1)!.startsWith("Exodus 1:2"));
    const cues = await estimateVerseCues(analysis.timingInputs);
    assert.equal(cues.length, 8);
    for (let i = 1; i < cues.length; i++) assert.ok(cues[i].start >= cues[i - 1].end - 1e-6);
    assert.equal(cues.at(-1)!.reference, "Exodus 1:2");
    const context = await readPassageTextContext(version, episode, index);
    assert.equal(context.filter(verse => verse.inPassage).length, 8);
    assert.deepEqual(context.filter(verse => !verse.inPassage).map(verse => verse.reference), ["Genesis 1:1", "Genesis 1:2", "Exodus 1:3", "Exodus 1:4"]);
    assert.throws(() => passageChapters(index, { ...episode, book: "exodus", endBook: "genesis" }), /precedes/);
  } finally {
    Object.assign(config, original);
    await fs.rm(root, { recursive: true, force: true });
  }
});
