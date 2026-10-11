import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupProjectFolders } from "./project-cleanup.js";

test("preview preserves all files; deletion removes only selected inactive folders within the selected root", async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "published-cleanup-"),
  );
  const root = path.join(temporary, "long", "outputs-dev");
  const project = (slug: string, base = root) => path.join(base, "kjv", slug);
  const published = [
    { id: 1, version: "kjv", slug: "published" },
    { id: 2, version: "kjv", slug: "active" },
    { id: 3, version: "kjv", slug: "missing" },
  ];
  const input = {
    kind: "long" as const,
    outputEnvironment: "development" as const,
    action: "preview" as const,
    projects: published,
  };
  try {
    const kept = [
      project("active"),
      project("unpublished"),
      project("published", path.join(temporary, "long", "outputs")),
      project("published", path.join(temporary, "short", "outputs-dev")),
    ];
    for (const directory of [project("published"), ...kept]) {
      await fs.mkdir(path.join(directory, "_internal"), { recursive: true });
      await fs.writeFile(
        path.join(directory, "_internal", "voice.wav"),
        "voice",
      );
      await fs.writeFile(path.join(directory, "video.mp4"), "video");
    }
    await fs.writeFile(path.join(root, "status.json"), "publication");
    const preview = await cleanupProjectFolders(input, root, new Set([2]));
    assert.deepEqual(preview.eligibleIds, [1]);
    assert.deepEqual(preview.skippedIds, [2]);
    assert.deepEqual(preview.missingIds, [3]);
    assert.equal(
      await fs.readFile(path.join(project("published"), "video.mp4"), "utf8"),
      "video",
    );
    const alias = await cleanupProjectFolders(
      {
        ...input,
        action: "delete",
        projects: [published[0], { ...published[0], id: 4 }],
      },
      root,
      new Set([4]),
    );
    assert.deepEqual(alias.deletedIds, []);
    assert.deepEqual(alias.skippedIds, [1]);
    const deleted = await cleanupProjectFolders(
      { ...input, action: "delete" },
      root,
      new Set([2]),
    );
    assert.deepEqual(deleted.deletedIds, [1]);
    await assert.rejects(fs.stat(project("published")), { code: "ENOENT" });
    for (const directory of kept)
      assert.equal(
        await fs.readFile(path.join(directory, "video.mp4"), "utf8"),
        "video",
      );
    assert.equal(
      await fs.readFile(path.join(root, "status.json"), "utf8"),
      "publication",
    );
    const repeat = await cleanupProjectFolders(
      { ...input, action: "delete" },
      root,
      new Set([2]),
    );
    assert.deepEqual(repeat.deletedIds, []);
    assert.deepEqual(repeat.missingIds, [1, 3]);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("cleanup rejects traversal and links to other projects or outside the output root", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "cleanup-links-"));
  const root = path.join(temporary, "outputs");
  const outside = path.join(temporary, "outside");
  try {
    await fs.mkdir(path.join(root, "kjv"), { recursive: true });
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, "keep"), "safe");
    await fs.symlink(outside, path.join(root, "kjv", "linked"));
    await fs.symlink(outside, path.join(root, "linked-version"));
    const request = {
      kind: "short" as const,
      outputEnvironment: "production" as const,
      action: "delete" as const,
      projects: [
        { id: 1, version: "kjv", slug: "linked" },
        { id: 2, version: "linked-version", slug: "nested" },
      ],
    };
    const result = await cleanupProjectFolders(request, root, new Set());
    assert.deepEqual(result.failedIds, [1, 2]);
    assert.equal(await fs.readFile(path.join(outside, "keep"), "utf8"), "safe");
    await assert.rejects(
      cleanupProjectFolders(
        {
          ...request,
          projects: [{ id: 3, version: "kjv", slug: "../../outside" }],
        },
        root,
        new Set(),
      ),
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
