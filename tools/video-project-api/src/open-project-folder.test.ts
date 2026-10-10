import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { openProjectFolder } from "./open-project-folder.js";

test("Finder opens only rendered projects inside their environment output root", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "project-folder-"));
  const root = path.join(temporary, "outputs-dev");
  const production = path.join(temporary, "outputs");
  const opened: string[] = [];
  const options = {
    platform: "darwin",
    open: async (folder: string) => {
      opened.push(folder);
    },
  };
  try {
    for (const kind of ["short", "long"] as const) {
      const folder = path.join(root, "rv1909", kind);
      await fs.mkdir(folder, { recursive: true });
      await assert.rejects(
        openProjectFolder(folder, root, kind, options),
        /no final video/,
      );
      await fs.writeFile(
        path.join(folder, kind === "short" ? "0-short.mp4" : "0-episode.mp4"),
        "video",
      );
      await openProjectFolder(folder, root, kind, options);
      assert.equal(opened.at(-1), await fs.realpath(folder));
      await assert.rejects(
        openProjectFolder(folder, root, kind, {
          ...options,
          platform: "linux",
        }),
        /macOS/,
      );
    }
    const outside = path.join(production, "rv1909", "short");
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(path.join(outside, "0-short.mp4"), "video");
    await assert.rejects(
      openProjectFolder(outside, root, "short", options),
      /outside/,
    );
    const link = path.join(root, "rv1909", "linked");
    await fs.symlink(outside, link);
    await assert.rejects(
      openProjectFolder(link, root, "short", options),
      /outside/,
    );
    await assert.rejects(
      openProjectFolder(root, root, "short", options),
      /outside/,
    );
    await assert.rejects(
      openProjectFolder(path.join(root, "missing"), root, "short", options),
    );
    assert.equal(opened.length, 2);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
