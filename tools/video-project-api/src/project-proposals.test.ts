import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadProjectProposals,
  projectProposalsSchema,
} from "./project-proposals.js";
test("proposal discovery reads the selected format file on every call and preserves cross-book boundaries", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "video-project-proposals-"),
  );
  const bible = path.join(root, "bible"),
    short = path.join(root, "short"),
    long = path.join(root, "long");
  const cross = {
    id: 33,
    slug: "episode-033",
    start: { book: "genesis", chapter: 50, verse: 20 },
    end: { book: "exodus", chapter: 1, verse: 3 },
  };
  const same = {
    id: 1,
    slug: "john-3-14-19",
    start: { book: "john", chapter: 3, verse: 14 },
    end: { book: "john", chapter: 3, verse: 19 },
  };
  try {
    await fs.mkdir(path.join(bible, "es", "custom"), { recursive: true });
    await fs.writeFile(
      path.join(bible, "es", "custom", "index.json"),
      JSON.stringify({
        books: [
          { id: "genesis", name: "Génesis" },
          { id: "exodus", name: "Éxodo" },
          { id: "john", name: "Juan" },
        ],
      }),
    );
    for (const directory of [short, long])
      await fs.mkdir(path.join(directory, "material"), { recursive: true });
    await fs.writeFile(
      path.join(short, "material", "video-project-presets.json"),
      JSON.stringify([same]),
    );
    await fs.writeFile(
      path.join(long, "material", "video-project-presets.json"),
      JSON.stringify([cross]),
    );
    assert.deepEqual(
      await loadProjectProposals(
        "short",
        { locale: "es", code: "custom" },
        short,
        bible,
      ),
      [{ ...same, title: "Juan 3:14–19" }],
    );
    assert.deepEqual(
      await loadProjectProposals(
        "long",
        { locale: "es", code: "custom" },
        long,
        bible,
      ),
      [{ ...cross, title: "Día 033 · Génesis 50:20–Éxodo 1:3" }],
    );
    await fs.writeFile(
      path.join(short, "material", "video-project-presets.json"),
      JSON.stringify([cross]),
    );
    assert.equal(
      (
        await loadProjectProposals(
          "short",
          { locale: "es", code: "custom" },
          short,
          bible,
        )
      )[0].end.book,
      "exodus",
    );
    assert.equal(projectProposalsSchema.safeParse([same, same]).success, false);
    assert.equal(
      projectProposalsSchema.safeParse([{ ...same, slug: "../bad" }]).success,
      false,
    );
    await fs.writeFile(
      path.join(long, "material", "video-project-presets.json"),
      "broken",
    );
    await assert.rejects(
      loadProjectProposals(
        "long",
        { locale: "es", code: "custom" },
        long,
        bible,
      ),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
