import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  discoverExistingProjects,
  existingRenderResult,
} from "./existing-projects.js";

test("existing production outputs import scoped publication, manual timings and audio settings without reading development outputs", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "existing-projects-"),
  );
  const versions = [
    { locale: "es" as const, code: "same", label: "Spanish" },
    { locale: "en" as const, code: "same", label: "English" },
  ];
  try {
    await fs.mkdir(path.join(directory, "material"));
    await fs.writeFile(
      path.join(directory, "material/video-project-presets.json"),
      JSON.stringify([
        {
          id: 1,
          slug: "episode-001",
          start: { book: "genesis", chapter: 50, verse: 20 },
          end: { book: "exodus", chapter: 1, verse: 3 },
        },
      ]),
    );
    const internal = path.join(directory, "outputs/same/episode-001/_internal");
    await fs.mkdir(internal, { recursive: true });
    await fs.writeFile(
      path.join(internal, "0-metadata.txt"),
      "ID del pasaje: episode-001\nIdioma: es\nReferencia: Génesis 50:20 – Éxodo 1:3\nAudio de intro y outro: mix\nVídeos: 0-intro.mp4, bg-2.mp4 (boomerang en bucle), 0-outro.mp4\n",
    );
    await fs.writeFile(
      path.join(internal, "2-passage-audio-offsets.json"),
      JSON.stringify({ startSeconds: -0.25, endSeconds: 0.5 }),
    );
    await fs.writeFile(
      path.join(internal, "2-verse-text-offsets.json"),
      JSON.stringify({
        verses: [
          {
            reference: "Génesis 50:20",
            startOffsetSeconds: 0.1,
            endOffsetSeconds: -0.2,
            estimatedStartSeconds: 0,
          },
        ],
      }),
    );
    await fs.writeFile(
      path.join(internal, "2-passage-audio-settings.json"),
      JSON.stringify({ volumeMultiplier: 1.75 }),
    );
    const record = {
      locale: "en",
      version: "same",
      usedAt: "2026-01-01",
      output: "unused-path",
    };
    await fs.writeFile(
      path.join(directory, "outputs/status.json"),
      JSON.stringify({ "episode-001": record }),
    );
    await fs.mkdir(path.join(directory, "outputs-dev/same/dev-only"), {
      recursive: true,
    });
    let result = await discoverExistingProjects("long", {
      directory,
      versions,
    });
    assert.equal(result.projects.length, 1);
    assert.equal(
      result.projects[0].published,
      false,
      "A legacy mark belongs only to its recorded language",
    );
    assert.equal(result.projects[0].passage.endBook, "exodus");
    assert.equal(result.projects[0].passage.episode, 1);
    assert.deepEqual(result.projects[0].settings, {
      passageOffsets: { startSeconds: -0.25, endSeconds: 0.5 },
      verseOffsets: [
        {
          reference: "Génesis 50:20",
          startOffsetSeconds: 0.1,
          endOffsetSeconds: -0.2,
        },
      ],
      volumeMultiplier: 1.75,
      background: "bg-2.mp4",
    });
    await fs.writeFile(
      path.join(directory, "outputs/status.json"),
      JSON.stringify({ "es/same/episode-001": { ...record, locale: "es" } }),
    );
    result = await discoverExistingProjects("long", { directory, versions });
    assert.equal(result.projects[0].published, true);
    await fs.writeFile(
      path.join(directory, "outputs/status.json"),
      JSON.stringify({}),
    );
    assert.equal(
      (await discoverExistingProjects("long", { directory, versions }))
        .projects[0].published,
      false,
    );
    await fs.writeFile(
      path.join(internal, "2-passage-audio-offsets.json"),
      "broken",
    );
    result = await discoverExistingProjects("long", { directory, versions });
    assert.equal(result.skipped, 1);
    assert.equal(result.projects.length, 0);
    await fs.writeFile(path.join(directory, "outputs/status.json"), "broken");
    await assert.rejects(
      discoverExistingProjects("long", { directory, versions }),
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("short outputs can be reconstructed from metadata and older timing filenames; final video needs no render manifest", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "existing-short-"));
  try {
    const project = path.join(directory, "outputs/rv1909/custom-passage");
    await fs.mkdir(path.join(project, "internal"), { recursive: true });
    await fs.writeFile(
      path.join(project, "internal/metadata.txt"),
      "Referencia: Juan 3:16–17\nLibro: Juan (john)\nIdioma: es\nInicio: 3:16\nFin: 3:17\n",
    );
    await fs.writeFile(
      path.join(project, "internal/offsets.json"),
      JSON.stringify({ startSeconds: 0, endSeconds: 0.3 }),
    );
    const input = {
      directory,
      versions: [{ locale: "es" as const, code: "rv1909", label: "RV1909" }],
    };
    const result = await discoverExistingProjects("short", input);
    assert.equal(result.projects[0].slug, "custom-passage");
    assert.equal(result.projects[0].passage.book, "john");
    assert.deepEqual(result.projects[0].settings.passageOffsets, {
      startSeconds: 0,
      endSeconds: 0.3,
    });
    assert.equal(await existingRenderResult(project, "short"), null);
    await fs.writeFile(path.join(project, "short.mp4"), "test-video");
    await fs.writeFile(path.join(project, "youtube.txt"), "Saved caption");
    assert.equal(
      (await existingRenderResult(project, "short"))?.descriptions[
        "3-youtube.txt"
      ],
      "Saved caption",
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("numbered final files are preferred for both formats and legacy texts retain their publication order", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "numbered-outputs-"),
  );
  try {
    for (const kind of ["short", "long"] as const) {
      const project = path.join(directory, kind);
      await fs.mkdir(project);
      const video = kind === "short" ? "0-short.mp4" : "0-episode.mp4";
      await fs.writeFile(path.join(project, video), "new");
      await fs.writeFile(path.join(project, video.slice(2)), "old");
      await fs.writeFile(
        path.join(project, "0-thumbnail.jpg"),
        "new thumbnail",
      );
      await fs.writeFile(path.join(project, "thumbnail.jpg"), "old thumbnail");
      await fs.writeFile(path.join(project, "youtube.txt"), "old description");
      await fs.writeFile(
        path.join(project, "3-youtube.txt"),
        "new description",
      );
      await fs.writeFile(path.join(project, "2-facebook.txt"), "Facebook");
      const result = await existingRenderResult(project, kind);
      assert.equal(result?.video, path.join(project, video));
      assert.equal(result?.thumbnail, path.join(project, "0-thumbnail.jpg"));
      assert.deepEqual(result?.descriptions, {
        "2-facebook.txt": "Facebook",
        "3-youtube.txt": "new description",
      });
      await fs.writeFile(path.join(project, "3.3-thumbnail.jpg"), "YouTube thumbnail");
      await fs.writeFile(path.join(project, "3.1-youtube.txt"), "Title");
      await fs.writeFile(path.join(project, "3.2-youtube.txt"), "Description");
      const updated = await existingRenderResult(project, kind);
      assert.equal(updated?.thumbnail, path.join(project, "3.3-thumbnail.jpg"));
      assert.equal(updated?.descriptions["3.1-youtube.txt"], "Title");
      assert.equal(updated?.descriptions["3.2-youtube.txt"], "Description");
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
