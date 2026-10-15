import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { applyStoredAlignment } from "./alignment-application";
import { settingsSchema } from "./video-schema";
import { settingsSchema as workerSettings } from "../../../../tools/video-project-api/src/protocol";
import {
  alignmentSignature,
  type AlignmentJob,
} from "../../../../tools/video-project-api/src/forced-alignment-result";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE video_projects(id INTEGER PRIMARY KEY, settings TEXT, updated_at TEXT)",
  );
  const initial = settingsSchema.parse({
    verseOffsets: [
      {
        reference: "manual",
        startOffsetSeconds: 7,
        endOffsetSeconds: 8,
        manuallyAdjusted: true,
      },
    ],
  });
  sqlite
    .prepare("INSERT INTO video_projects(id,settings) VALUES(1,?)")
    .run(JSON.stringify(initial));
  const database = {
    prepare(query: string) {
      return {
        bind(...args: any[]) {
          return {
            async run() {
              return {
                meta: {
                  changes: Number(sqlite.prepare(query).run(...args).changes),
                },
              };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  const project = () => ({
    id: 1,
    kind: "long",
    version_code: "kjv",
    locale: "en",
    passage: JSON.stringify({ id: "test" }),
    settings: String(
      sqlite.prepare("SELECT settings FROM video_projects WHERE id=1").get()!
        .settings,
    ),
  });
  const jobs: AlignmentJob[] = [0, 1].map((sectionIndex) => ({
    id: crypto.randomUUID(),
    sectionIndex,
    status: "done",
    stage: "Complete",
    progress: 100,
    result: {
      signature: alignmentSignature({
        kind: "long",
        version: { id: "kjv", locale: "en" },
        passage: { id: "test" },
        settings: initial,
      }),
      model: "test",
      offsets: [
        {
          reference: `verse-${sectionIndex}`,
          startOffsetSeconds: sectionIndex + 1,
          endOffsetSeconds: sectionIndex + 2,
        },
        { reference: "manual", startOffsetSeconds: 0, endOffsetSeconds: 0 },
      ],
      padding: [
        { sectionIndex, beforeSeconds: sectionIndex + 1, afterSeconds: 2 },
      ],
    },
  }));
  return { sqlite, database, project, jobs, initial };
}

test("completed jobs apply by ID, persist together, preserve manual edits and remain idempotent after reload", async () => {
  const f = fixture();
  try {
    let currentSettings = f.initial;
    for (const job of f.jobs) {
      const project = f.project();
      const result = await applyStoredAlignment({
        jobId: job.id,
        currentSettings,
        expectedSettings: project.settings,
        project,
        jobs: f.jobs,
        database: f.database,
      });
      assert.ok("settings" in result);
      currentSettings = result.settings;
    }
    const saved = settingsSchema.parse(JSON.parse(f.project().settings));
    assert.deepEqual(saved, currentSettings);
    assert.deepEqual(
      saved.alignmentAppliedJobIds,
      f.jobs.map((job) => job.id),
    );
    assert.equal(
      saved.verseOffsets.find((item) => item.reference === "manual")
        ?.startOffsetSeconds,
      7,
    );
    assert.deepEqual(
      saved.verseOffsets.map((item) => item.reference),
      ["manual", "verse-0", "verse-1"],
    );
    assert.equal(saved.readingSectionPadding.length, 2);
    assert.deepEqual(
      workerSettings.parse(saved).alignmentAppliedJobIds,
      saved.alignmentAppliedJobIds,
    );
    // A user reset after both jobs must not be overwritten by replaying the older job.
    const reset = {
      ...saved,
      verseOffsets: [],
      alignmentAppliedJobIds: undefined,
      alignmentJobId: undefined,
    };
    const project = f.project();
    const replay = await applyStoredAlignment({
      jobId: f.jobs[0].id,
      currentSettings: reset,
      expectedSettings: project.settings,
      project,
      jobs: f.jobs,
      database: f.database,
    });
    assert.ok("settings" in replay);
    assert.deepEqual(replay.settings.verseOffsets, []);
    assert.deepEqual(
      replay.settings.alignmentAppliedJobIds,
      saved.alignmentAppliedJobIds,
    );
    assert.equal(f.project().settings, project.settings);
  } finally {
    f.sqlite.close();
  }
});

test("application rejects unfinished, stale and concurrent results without modifying stored settings", async () => {
  const f = fixture();
  try {
    const project = f.project();
    const submit = (overrides: Record<string, unknown> = {}) =>
      applyStoredAlignment({
        jobId: f.jobs[0].id,
        currentSettings: f.initial,
        expectedSettings: project.settings,
        project,
        jobs: f.jobs,
        database: f.database,
        ...overrides,
      });
    assert.equal(
      "error" in (await submit({ expectedSettings: "older snapshot" })),
      true,
    );
    assert.equal(
      "error" in
        (await submit({ jobs: [{ ...f.jobs[0], status: "running" }] })),
      true,
    );
    assert.equal(
      "error" in (await submit({ jobId: crypto.randomUUID() })),
      true,
    );
    assert.equal(
      "error" in
        (await submit({
          currentSettings: {
            ...f.initial,
            passageOffsets: { startSeconds: 1, endSeconds: 0 },
          },
        })),
      true,
    );
    f.sqlite
      .prepare("UPDATE video_projects SET settings='{}' WHERE id=1")
      .run();
    // Even if the request loaded the old row, the write checks it again atomically.
    assert.equal("error" in (await submit()), true);
    assert.equal(f.project().settings, "{}");
  } finally {
    f.sqlite.close();
  }
});
