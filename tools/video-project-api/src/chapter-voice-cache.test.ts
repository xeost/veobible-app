import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ChapterVoiceCache } from "./chapter-voice-cache";

test("complete chapter voices are shared across projects, separated by language and atomically regenerated", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "chapter-cache-"));
  try {
    const cache = new ChapterVoiceCache(directory);
    const identity = { chapter: 1, locale: "es" as const, complete: true };
    const audio = path.join(directory, "voice.wav");
    const script = path.join(directory, "voice.txt");
    await fs.writeFile(audio, "original voice");
    await fs.writeFile(script, "Capítulo uno.");
    await cache.publish(audio, script, identity);
    const otherProject = path.join(
      directory,
      "outputs-dev",
      "other-version",
      "project",
      "_internal",
      "2-chapter-3.wav",
    );
    const resolved = await cache.resolve(otherProject, identity);
    assert.equal(resolved.available, true);
    assert.equal(resolved.cached, true);
    assert.equal(
      resolved.file,
      path.join(directory, "cache", "chapter-voices", "es", "chapter-1.wav"),
    );
    await assert.rejects(fs.stat(path.dirname(otherProject)), {
      code: "ENOENT",
    });
    assert.equal(
      (await cache.resolve(otherProject, { ...identity, locale: "pt" }))
        .available,
      false,
    );
    assert.equal(
      (await cache.resolve(otherProject, { ...identity, chapter: 2 }))
        .available,
      false,
    );
    assert.equal(
      (await cache.resolve(otherProject, { ...identity, complete: false }))
        .available,
      false,
    );
    await assert.rejects(
      cache.publish(audio, script, { ...identity, complete: false }),
      /Partial chapter/,
    );
    await fs.writeFile(audio, "regenerated voice");
    await cache.publish(audio, script, identity);
    assert.equal(
      await fs.readFile(
        (await cache.resolve(otherProject, identity)).file,
        "utf8",
      ),
      "regenerated voice",
    );
    assert.deepEqual((await fs.readdir(path.dirname(resolved.file))).sort(), [
      "chapter-1.txt",
      "chapter-1.wav",
    ]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("older complete voices are adopted once and partial voices remain specific to their project", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "chapter-cache-legacy-"),
  );
  try {
    const cache = new ChapterVoiceCache(directory);
    const identity = { chapter: 7, locale: "en" as const, complete: true };
    const projectFile = path.join(directory, "project.wav");
    await fs.writeFile(projectFile, "old complete voice");
    await fs.writeFile(projectFile.replace(".wav", ".txt"), "Chapter seven.");
    const resolved = await cache.resolve(projectFile, identity);
    assert.equal(
      await fs.readFile(resolved.file, "utf8"),
      "old complete voice",
    );
    await fs.writeFile(projectFile, "stale project copy");
    assert.equal(
      await fs.readFile(
        (await cache.resolve(projectFile, identity)).file,
        "utf8",
      ),
      "old complete voice",
    );
    const partial = await cache.resolve(projectFile, {
      ...identity,
      complete: false,
    });
    assert.equal(partial.cached, false);
    assert.equal(partial.file, projectFile);
    assert.equal(await fs.readFile(partial.file, "utf8"), "stale project copy");
    assert.throws(
      () => cache.file({ ...identity, locale: "../../unsafe" as "en" }),
      /Invalid chapter/,
    );
    assert.throws(
      () => cache.file({ ...identity, chapter: -1 }),
      /Invalid chapter/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
