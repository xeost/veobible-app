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
