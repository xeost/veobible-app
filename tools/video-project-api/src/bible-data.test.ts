import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as shortConfig } from "./engines/short/config";
import { config as longConfig } from "./engines/long/config";
test("both video formats read every Bible version from the frontend static directory", async () => {
  const expected = fileURLToPath(
    new URL("../../../apps/frontend/public/bible-data", import.meta.url),
  );
  for (const config of [shortConfig, longConfig]) {
    assert.equal(config.bibleDataDir, expected);
    for (const version of config.versions) {
      const root = path.join(config.bibleDataDir, version.locale, version.id);
      const index = JSON.parse(
        await fs.readFile(path.join(root, "index.json"), "utf8"),
      );
      assert.ok(index.books.length > 0);
      const chapter = JSON.parse(
        await fs.readFile(path.join(root, index.books[0].id, "1.json"), "utf8"),
      );
      assert.ok(chapter.length > 0);
    }
  }
});

test("overrides take precedence per file and only missing files fall back", async () => {
  const { default: os } = await import("node:os");
  const { readBibleDataFile } = await import("./bible-data.js");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bible-overrides-"));
  const original = path.join(root, "original"), overrides = path.join(root, "overrides");
  try {
    for (const source of [original, overrides]) await fs.mkdir(source);
    await fs.writeFile(path.join(original, "index.json"), '{"name":"Original"}');
    await fs.writeFile(path.join(overrides, "index.json"), '{"name":"Override"}');
    await fs.writeFile(path.join(original, "chapter.json"), "Original chapter");
    assert.equal(JSON.parse(await readBibleDataFile("index.json", original, overrides)).name, "Override");
    assert.equal(await readBibleDataFile("chapter.json", original, overrides), "Original chapter");
    await fs.writeFile(path.join(overrides, "index.json"), "malformed");
    await assert.rejects(async () => JSON.parse(await readBibleDataFile("index.json", original, overrides)));
    await fs.mkdir(path.join(overrides, "chapter.json"));
    await assert.rejects(readBibleDataFile("chapter.json", original, overrides));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("both video engines use ARC override texts and chapter lengths", async () => {
  const short = await import("./engines/short/shorts.js");
  const long = await import("./engines/long/episodes.js");
  for (const [config, engine] of [[shortConfig, short], [longConfig, long]] as const) {
    const version = config.versions.find((v) => v.locale === "pt" && v.id === "arc")!;
    assert.ok(version);
    const index = await engine.readIndex(version);
    assert.equal(index.books.find((b) => b.id === "judges")?.versesPerChapter[4], 32);
    const passage = {
      id: "genesis-1-1", book: "genesis",
      start: { book: "genesis", chapter: 1, verse: 1 },
      end: { book: "genesis", chapter: 1, verse: 1 },
    };
    const context = await engine.readPassageTextContext(version, passage);
    assert.equal(context.find((v) => v.inPassage)?.text, "No princípio criou Deus o céu e a terra.");
  }
});
