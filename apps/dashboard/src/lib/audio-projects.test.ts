import {
  audioVerseApproval,
  isAudioVerseApproved,
} from "../../../../tools/video-project-api/src/audio-approvals";
import { withAudioVersePause } from "./audio-settings";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  insertAudioProjects,
  listAudioProjects,
  findAudioProject,
  saveAudioProject,
  beginAudioJob,
  applyAudioEvent,
  failAudioJob,
  audioProjectCallback,
} from "./audio-projects";
import { saveBibleVersion, deleteBibleVersion } from "./bible-versions";
import type { AudioProject } from "../../../../tools/video-project-api/src/audio-project-schema";
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of [
    "0001_dashboard.sql",
    "0004_audio_projects.sql",
    "0005_audio_project_environments.sql",
  ])
    sqlite.exec(
      readFileSync(
        new URL(`../../migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  sqlite
    .prepare("INSERT INTO bible_versions(id,locale,code,label) VALUES(1,?,?,?)")
    .run("es", "rv1909", "Reina Valera 1909");
  type Statement = {
    query: string;
    args: any[];
    bind: (...args: any[]) => Statement;
    first: () => Promise<unknown>;
    all: () => Promise<unknown>;
    run: () => Promise<unknown>;
  };
  const database = {
    prepare(query: string) {
      const stmt: Statement = {
        query,
        args: [],
        bind(...args: any[]) {
          stmt.args = args;
          return stmt;
        },
        async first() {
          return sqlite.prepare(query).get(...stmt.args) ?? null;
        },
        async all() {
          return { results: sqlite.prepare(query).all(...stmt.args) };
        },
        async run() {
          const r = sqlite.prepare(query).run(...stmt.args);
          return {
            meta: {
              changes: Number(r.changes),
              last_row_id: Number(r.lastInsertRowid),
            },
          };
        },
      };
      return stmt;
    },
    async batch(statements: Statement[]) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const stmt of statements) results.push(await stmt.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  const project: AudioProject = {
    outputEnvironment: "production",
    edition: "rv1909-v2",
    version: {
      id: 1,
      code: "rv1909",
      locale: "es",
      label: "Reina Valera 1909",
    },
    book: "jude",
    title: "Judas",
    order: 65,
    chapterCount: 1,
    verseCounts: [25],
    settings: { baseVoice: "es-1", trims: {}, pauses: {} },
    revision: 0,
    recordings: {},
    chapters: {},
    status: "draft",
    progress: 0,
    updatedAt: new Date().toISOString(),
  };
  return { sqlite, database, project };
}
test("audio projects retain the format voice selection when saved and reloaded", async () => {
  const { sqlite, database, project } = fixture();
  try {
    await insertAudioProjects(database, [project]);
    await saveAudioProject(database, project.edition, project.book, {
      revision: 0,
      settings: { ...project.settings, inheritBaseVoice: true },
    });
    const inherited = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.equal(inherited.settings.inheritBaseVoice, true);
    assert.equal(inherited.settings.narrationPreset, undefined);
    await saveAudioProject(database, project.edition, project.book, {
      revision: inherited.revision,
      settings: {
        ...inherited.settings,
        baseVoice: "es-3",
        inheritBaseVoice: false,
      },
    });
    const explicit = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.equal(explicit.settings.inheritBaseVoice, false);
    assert.equal(explicit.settings.baseVoice, "es-3");
  } finally {
    sqlite.close();
  }
});

test("legacy audio defaults upgrade once without changing recordings or generation state", async () => {
  const { sqlite, database, project } = fixture();
  try {
    project.status = "done";
    project.revision = 7;
    await insertAudioProjects(database, [project]);
    const first = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.equal(first.settings.inheritBaseVoice, true);
    assert.equal(first.settings.voiceDefaultsVersion, 1);
    assert.equal(first.status, "done");
    assert.equal(first.revision, 7);
    assert.deepEqual(first.recordings, project.recordings);
    assert.deepEqual(first.chapters, project.chapters);
    const stored = sqlite.prepare("SELECT settings FROM audio_projects").get()!
      .settings;
    sqlite
      .prepare("INSERT INTO site_settings(key,value) VALUES (?,?)")
      .run(
        "base_voice_defaults:audio",
        JSON.stringify({ en: "en-1", es: "es-3", pt: "pt-1" }),
      );
    const again = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.equal(again.settings.inheritBaseVoice, true);
    assert.equal(
      sqlite.prepare("SELECT settings FROM audio_projects").get()!.settings,
      stored,
    );
  } finally {
    sqlite.close();
  }
});

test("audio projects persist independently of the worker and protect version identities", async () => {
  const { sqlite, database, project } = fixture();
  try {
    await insertAudioProjects(database, [project]);
    assert.equal((await listAudioProjects(database)).length, 1);
    const { row } = await findAudioProject(
      database,
      project.edition,
      project.book,
    );
    assert.equal(row.bible_version_id, 1);
    const saved = await saveAudioProject(
      database,
      project.edition,
      project.book,
      {
        revision: 0,
        settings: { ...project.settings, pauses: { "1:1": 0.7 } },
      },
    );
    assert.equal(saved.revision, 1);
    await assert.rejects(
      saveAudioProject(database, project.edition, project.book, {
        revision: 0,
        settings: project.settings,
      }),
      /Reload/,
    );
    await assert.rejects(
      saveAudioProject(database, project.edition, project.book, {
        revision: 1,
        settings: { ...project.settings, pauses: { "1:26": 1 } },
      }),
      /Verse not found/,
    );
    await assert.rejects(
      deleteBibleVersion(database, 1),
      /associated projects/,
    );
    await assert.rejects(
      saveBibleVersion(
        database,
        { locale: "es", code: "renamed", label: "name" },
        1,
      ),
      /associated projects/,
    );
    assert.equal(
      (await findAudioProject(database, project.edition, project.book)).project
        .settings.pauses["1:1"],
      0.7,
    );
  } finally {
    sqlite.close();
  }
});
test("job updates persist each completed verse and reject stale, duplicate and unauthorized updates", async () => {
  const { sqlite, database, project } = fixture();
  try {
    await insertAudioProjects(database, [project]);
    const job = await beginAudioJob(database, project.edition, project.book);
    await assert.rejects(
      beginAudioJob(database, project.edition, project.book),
      /Wait/,
    );
    await assert.rejects(
      saveAudioProject(database, project.edition, project.book, {
        revision: 1,
        settings: project.settings,
      }),
      /Wait/,
    );
    const generated = {
      ...job.project,
      status: "running" as const,
      progress: 40,
      recordings: {
        "1:1": {
          file: "jude/1-1-recording/intro.wav",
          duration: 2,
          revision: "recording",
        },
      },
    };
    await assert.rejects(
      applyAudioEvent(
        database,
        job.id,
        job.jobId,
        { sequence: 1, project: generated },
        "wrong-token",
      ),
      /Unauthorized/,
    );
    assert.equal(
      (
        await applyAudioEvent(
          database,
          job.id,
          job.jobId,
          { sequence: 2, project: generated },
          job.token,
        )
      ).applied,
      true,
    );
    assert.equal(
      (
        await applyAudioEvent(
          database,
          job.id,
          job.jobId,
          { sequence: 1, project: job.project },
          job.token,
        )
      ).applied,
      false,
    );
    const stored = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.equal(stored.recordings["1:1"].duration, 2);
    await applyAudioEvent(
      database,
      job.id,
      job.jobId,
      { sequence: 3, project: { ...generated, status: "failed" } },
      job.token,
    );
    const resumed = await beginAudioJob(
      database,
      project.edition,
      project.book,
    );
    assert.deepEqual(resumed.project.recordings, generated.recordings);
    await assert.rejects(
      applyAudioEvent(
        database,
        job.id,
        job.jobId,
        { sequence: 99, project: { ...generated, status: "done" } },
        job.token,
      ),
      /Unauthorized/,
    );
    await failAudioJob(database, resumed.id, resumed.jobId);
    assert.equal(
      (await findAudioProject(database, project.edition, project.book)).project
        .status,
      "failed",
    );
  } finally {
    sqlite.close();
  }
});
test("callback authentication works without browser cookies and rejects cross-project state", async () => {
  const { sqlite, database, project } = fixture();
  try {
    await insertAudioProjects(database, [project]);
    const job = await beginAudioJob(database, project.edition, project.book);
    const url = `http://dashboard.test/api/audio-project-events/${job.id}/${job.jobId}`;
    const request = (token: string, p = job.project) =>
      new Request(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sequence: 1,
          project: { ...p, status: "running" },
        }),
      });
    assert.equal(
      (await audioProjectCallback(request("wrong"), database))!.status,
      401,
    );
    assert.equal(
      (await audioProjectCallback(
        request(job.token, { ...job.project, edition: "rv1909-v3" }),
        database,
      ))!.status,
      400,
    );
    assert.equal(
      (await audioProjectCallback(request(job.token), database))!.status,
      200,
    );
    assert.equal(
      (await audioProjectCallback(request(job.token), database))!.status,
      200,
    );
  } finally {
    sqlite.close();
  }
});
test("edition/book uniqueness and foreign keys make a failed batch atomic", async () => {
  const { sqlite, database, project } = fixture();
  try {
    await assert.rejects(insertAudioProjects(database, [project, project]));
    assert.equal((await listAudioProjects(database)).length, 0);
    await assert.rejects(
      insertAudioProjects(database, [
        { ...project, version: { ...project.version, id: 99 } },
      ]),
    );
  } finally {
    sqlite.close();
  }
});

test("database project identities, settings and callbacks are separated by environment", async () => {
  const { sqlite, database, project } = fixture();
  try {
    await insertAudioProjects(database, [project]);
    const dev = { ...project, outputEnvironment: "development" as const };
    await insertAudioProjects(database, [dev], "development");
    const prodRow = await findAudioProject(
      database,
      project.edition,
      project.book,
    );
    const devRow = await findAudioProject(
      database,
      project.edition,
      project.book,
      "development",
    );
    assert.notEqual(prodRow.row.id, devRow.row.id);
    assert.equal((await listAudioProjects(database)).length, 1);
    assert.equal(
      (await listAudioProjects(database, "development"))[0].outputEnvironment,
      "development",
    );
    await assert.rejects(
      insertAudioProjects(database, [{ ...dev, edition: "rv1909-v3" }]),
      /does not match/,
    );
    await saveAudioProject(
      database,
      dev.edition,
      dev.book,
      { revision: 0, settings: { ...dev.settings, pauses: { "1:1": 0.8 } } },
      "development",
    );
    assert.deepEqual(
      (await findAudioProject(database, project.edition, project.book)).project
        .settings.pauses,
      {},
    );
    const prodJob = await beginAudioJob(
      database,
      project.edition,
      project.book,
    );
    const devJob = await beginAudioJob(
      database,
      dev.edition,
      dev.book,
      "development",
    );
    await assert.rejects(
      applyAudioEvent(
        database,
        prodJob.id,
        prodJob.jobId,
        { sequence: 1, project: { ...devJob.project, status: "running" } },
        prodJob.token,
      ),
      /does not match/,
    );
    await applyAudioEvent(
      database,
      devJob.id,
      devJob.jobId,
      {
        sequence: 1,
        project: { ...devJob.project, status: "running", progress: 35 },
      },
      devJob.token,
    );
    assert.equal(
      (await findAudioProject(database, project.edition, project.book)).project
        .progress,
      0,
    );
    assert.equal(
      (await findAudioProject(database, dev.edition, dev.book, "development"))
        .project.progress,
      35,
    );
  } finally {
    sqlite.close();
  }
});

test("environment migration preserves existing projects, state and IDs in production", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const file of ["0001_dashboard.sql", "0004_audio_projects.sql"])
      sqlite.exec(
        readFileSync(
          new URL(`../../migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    sqlite.exec(
      "INSERT INTO bible_versions(id,locale,code,label) VALUES(1,'es','rv1909','Original')",
    );
    const insert = sqlite.prepare(
      "INSERT INTO audio_projects(id,bible_version_id,edition,book,title,book_order,chapter_count,verse_counts,settings,recordings,status,progress,revision) VALUES(?,1,'rv1909-v2','jude','Judas',65,1,'[25]','{}','{}','failed',35,7)",
    );
    insert.run(40);
    sqlite.exec("DELETE FROM audio_projects WHERE id=40");
    insert.run(3);
    const before = sqlite.prepare("SELECT * FROM audio_projects").get()!;
    sqlite.exec(
      readFileSync(
        new URL(
          "../../migrations/0005_audio_project_environments.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const after = sqlite.prepare("SELECT * FROM audio_projects").get()!;
    assert.equal(after.output_environment, "production");
    delete after.output_environment;
    assert.deepEqual(after, before);
    const result = sqlite
      .prepare(
        "INSERT INTO audio_projects(output_environment,bible_version_id,edition,book,title,book_order,chapter_count,verse_counts,settings) VALUES('development',1,'rv1909-v2','jude','Judas',65,1,'[25]','{}')",
      )
      .run();
    assert.ok(Number(result.lastInsertRowid) > 40);
  } finally {
    sqlite.close();
  }
});

test("global audio pause overrides legacy verse pauses and is frozen in the queued snapshot", async () => {
  const { sqlite, database, project } = fixture();
  try {
    project.settings.pauses = { "1:1": 2, "1:2": 3 };
    const resolved = withAudioVersePause(project.settings, [2, 1], 0);
    assert.deepEqual(resolved.pauses, { "1:1": 0, "1:2": 0, "2:1": 0 });
    assert.deepEqual(project.settings.pauses, { "1:1": 2, "1:2": 3 });
    await insertAudioProjects(database, [project]);
    const job = await beginAudioJob(
      database,
      project.edition,
      project.book,
      "production",
      0.6,
    );
    assert.equal(Object.keys(job.project.settings.pauses).length, 25);
    assert.ok(
      Object.values(job.project.settings.pauses).every(
        (pause) => pause === 0.6,
      ),
    );
    assert.deepEqual(
      (await findAudioProject(database, project.edition, project.book)).project
        .settings,
      job.project.settings,
    );
    await assert.rejects(
      beginAudioJob(database, project.edition, project.book, "production", 0.9),
    );
    assert.deepEqual(
      (await findAudioProject(database, project.edition, project.book)).project
        .settings,
      job.project.settings,
    );
  } finally {
    sqlite.close();
  }
});

test("verse approvals persist without invalidating completed chapter audio and follow recording revisions", async () => {
  const { sqlite, database, project } = fixture();
  try {
    project.recordings["1:1"] = {
      file: "jude/one.wav",
      duration: 2,
      revision: "first",
    };
    project.settings.trims["1:1"] = { startSeconds: 0.2, endSeconds: 1.8 };
    project.chapters["1"] = { file: "65-jude-1.mp3", revision: "final" };
    project.status = "done";
    await insertAudioProjects(database, [project]);
    const approval = audioVerseApproval(project, project.settings, "1:1")!;
    const saved = await saveAudioProject(
      database,
      project.edition,
      project.book,
      {
        revision: project.revision,
        settings: { ...project.settings, approvals: { "1:1": approval } },
      },
    );
    assert.equal(saved.status, "done");
    assert.deepEqual(saved.chapters, project.chapters);
    const reloaded = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.equal(
      isAudioVerseApproved(reloaded, reloaded.settings, "1:1"),
      true,
    );
    const unapproved = await saveAudioProject(
      database,
      project.edition,
      project.book,
      {
        revision: saved.revision,
        settings: { ...saved.settings, approvals: {} },
      },
    );
    assert.deepEqual(unapproved.chapters, project.chapters);
    assert.equal(
      isAudioVerseApproved(unapproved, unapproved.settings, "1:1"),
      false,
    );
    const again = await saveAudioProject(
      database,
      project.edition,
      project.book,
      {
        revision: unapproved.revision,
        settings: saved.settings,
      },
    );
    const changed = await saveAudioProject(
      database,
      project.edition,
      project.book,
      {
        revision: again.revision,
        settings: {
          ...again.settings,
          trims: { "1:1": { startSeconds: 0.3, endSeconds: 1.8 } },
        },
      },
    );
    assert.equal(isAudioVerseApproved(changed, changed.settings, "1:1"), false);
    assert.deepEqual(changed.chapters, {});
    const job = await beginAudioJob(database, project.edition, project.book);
    assert.deepEqual(job.project.settings.approvals, saved.settings.approvals);
    const updated: AudioProject = structuredClone(job.project);
    updated.status = "draft";
    updated.recordings["1:1"].revision = "regenerated";
    await applyAudioEvent(
      database,
      job.id,
      job.jobId,
      { sequence: 1, project: updated },
      job.token,
    );
    const after = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.deepEqual(after.settings.approvals, saved.settings.approvals);
    assert.equal(isAudioVerseApproved(after, after.settings, "1:1"), false);
  } finally {
    sqlite.close();
  }
});

test("editor polling avoids reading recordings and returns a tiny unchanged response", async (t) => {
  const { audioEditorHeader, audioEditorState } =
    await import("./audio-editor-state");
  const { sqlite, database, project } = fixture();
  try {
    project.settings.voiceDefaultsVersion = 1;
    project.book = "genesis";
    project.title = "Genesis";
    project.order = 1;
    project.chapterCount = 50;
    project.verseCounts = Array(50).fill(31);
    project.recordings = Object.fromEntries(
      Array.from({ length: 1533 }, (_, i) => [
        `${Math.floor(i / 31) + 1}:${(i % 31) + 1}`,
        {
          file: `genesis/${i}/intro.wav`,
          duration: 7,
          revision: `recording-${i}`,
        },
      ]),
    );
    await insertAudioProjects(database, [project]);
    const queries: string[] = [];
    const traced = {
      ...database,
      prepare(query: string) {
        queries.push(query);
        return database.prepare(query);
      },
    } as D1Database;
    const header = await audioEditorHeader(
      traced,
      project.edition,
      project.book,
      "production",
    );
    const response = await audioEditorState(
      traced,
      header,
      project.revision,
      async () => {
        throw new Error("idle projects must not contact generation");
      },
      async () => {
        throw new Error(
          "unchanged polls must not reload defaults or sign media",
        );
      },
    );
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), { unchanged: true, revision: 0 });
    assert.ok(body.length < 50);
    t.diagnostic(
      `Large-book state: ${JSON.stringify(project).length} bytes; unchanged poll: ${body.length} bytes; one metadata query.`,
    );
    assert.equal(queries.length, 1);
    assert.ok(!queries[0].includes("p.*"));
    assert.ok(!queries[0].includes("recordings"));
    const raw = await audioEditorState(
      database,
      header,
      null,
      async () => {
        throw new Error("unexpected forward");
      },
      async () => ({ mediaAccess: "fixture" }),
    );
    const initial = (await raw.json()) as any;
    assert.deepEqual(
      initial.project,
      (await findAudioProject(database, project.edition, project.book)).project,
    );
    assert.equal(initial.extras.mediaAccess, "fixture");
  } finally {
    sqlite.close();
  }
});

test("editor progress reconciles missed callbacks and interrupted service snapshots without Bible text", async () => {
  const { audioEditorHeader, audioEditorState } =
    await import("./audio-editor-state");
  const { sqlite, database, project } = fixture();
  try {
    project.settings.voiceDefaultsVersion = 1;
    await insertAudioProjects(database, [project]);
    const job = await beginAudioJob(database, project.edition, project.book);
    const header = await audioEditorHeader(
      database,
      project.edition,
      project.book,
      "production",
    );
    const calls: { path: string; body: any }[] = [];
    const response = await audioEditorState(
      database,
      header,
      header.revision,
      async (path, body) => {
        calls.push({ path, body });
        if (path.endsWith("/updates"))
          return Response.json({ needsSnapshot: true }, { status: 409 });
        return Response.json({ ...job.project, status: "failed", sequence: 1 });
      },
      async () => {
        throw new Error("polls must not load initial extras");
      },
    );
    const result = (await response.json()) as any;
    assert.equal(result.project.status, "failed");
    assert.equal(result.project.revision, header.revision + 1);
    assert.equal(result.project.content, undefined);
    assert.deepEqual(calls[0].body, { jobId: job.jobId, sequence: 0 });
    assert.equal(calls[1].body.includeContent, false);
    assert.equal(calls[1].body.project.book, project.book);
    assert.equal(
      (await findAudioProject(database, project.edition, project.book)).row
        .job_sequence,
      1,
    );
  } finally {
    sqlite.close();
  }
});

test("incremental audio callbacks persist only changed verses, authenticate and fence sequences", async () => {
  const { applyAudioPatch } = await import("./audio-projects");
  const { audioProjectPatch } =
    await import("../../../../tools/video-project-api/src/audio-project-patch");
  const { sqlite, database, project } = fixture();
  try {
    await insertAudioProjects(database, [project]);
    const job = await beginAudioJob(database, project.edition, project.book);
    const first: AudioProject = structuredClone(job.project);
    first.status = "running";
    first.recordings["1:1"] = {
      file: "jude/1-1-r1/intro.wav",
      duration: 2,
      revision: "r1",
    };
    first.settings.trims["1:1"] = { startSeconds: 0.1, endSeconds: 1.8 };
    const event = {
      sequence: 1,
      baseSequence: 0,
      patch: audioProjectPatch(job.project, first),
    };
    await assert.rejects(
      applyAudioPatch(database, job.id, job.jobId, event, "wrong-token"),
      /Unauthorized/,
    );
    assert.deepEqual(
      await applyAudioPatch(database, job.id, job.jobId, event, job.token),
      { applied: true },
    );
    assert.deepEqual(
      await applyAudioPatch(database, job.id, job.jobId, event, job.token),
      { applied: false },
    );
    const second = structuredClone(first);
    second.recordings["1:2"] = {
      file: "jude/1-2-r2/intro.wav",
      duration: 3,
      revision: "r2",
    };
    second.settings.trims["1:2"] = { startSeconds: 0, endSeconds: 2.5 };
    const next = {
      sequence: 2,
      baseSequence: 1,
      patch: audioProjectPatch(first, second),
    };
    assert.deepEqual(Object.keys(next.patch.recordings), ["1:2"]);
    await assert.rejects(
      applyAudioPatch(
        database,
        job.id,
        job.jobId,
        { ...next, baseSequence: 0 },
        job.token,
      ),
      /current snapshot/,
    );
    await applyAudioPatch(database, job.id, job.jobId, next, job.token);
    const saved = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.deepEqual(saved.recordings, second.recordings);
    assert.deepEqual(saved.settings.trims, second.settings.trims);
    assert.equal(saved.settings.baseVoice, second.settings.baseVoice);
    assert.deepEqual(saved.settings.pauses, second.settings.pauses);
    assert.equal(saved.revision, job.project.revision + 2);
    const invalidTrim = {
      sequence: 3,
      baseSequence: 2,
      patch: {
        ...audioProjectPatch(second, second),
        settings: { trims: { "1:1": { startSeconds: 0, endSeconds: 20 } } },
      },
    };
    await assert.rejects(
      applyAudioPatch(database, job.id, job.jobId, invalidTrim, job.token),
      /outside this verse/,
    );
    const traversal = {
      sequence: 3,
      baseSequence: 2,
      patch: {
        ...next.patch,
        recordings: {
          "1:2": { file: "jude/../outside.wav", duration: 3, revision: "x" },
        },
      },
    };
    await assert.rejects(
      applyAudioPatch(database, job.id, job.jobId, traversal, job.token),
      /Invalid audio file/,
    );
    assert.equal(
      (await findAudioProject(database, project.edition, project.book)).row
        .job_sequence,
      2,
    );
    const removed = structuredClone(second);
    delete removed.settings.trims["1:1"];
    removed.chapters["1"] = { file: "65-jude-1.mp3", revision: "chapter1" };
    removed.status = "done";
    await applyAudioPatch(
      database,
      job.id,
      job.jobId,
      {
        sequence: 3,
        baseSequence: 2,
        patch: audioProjectPatch(second, removed),
      },
      job.token,
    );
    const final = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.deepEqual(final.settings.trims, removed.settings.trims);
    assert.deepEqual(final.chapters, removed.chapters);
    assert.equal(final.status, "done");
  } finally {
    sqlite.close();
  }
});

test("active editor polls stay compact and observe callbacks committed during inspection", async () => {
  const { audioEditorHeader, audioEditorState } =
    await import("./audio-editor-state");
  const { sqlite, database, project } = fixture();
  try {
    project.settings.voiceDefaultsVersion = 1;
    await insertAudioProjects(database, [project]);
    const job = await beginAudioJob(database, project.edition, project.book);
    const header = await audioEditorHeader(
      database,
      project.edition,
      project.book,
      "production",
    );
    let extraCalls = 0;
    const extras = async () => {
      extraCalls++;
      return {};
    };
    const unchanged = await audioEditorState(
      database,
      header,
      header.revision,
      async (_path, body) => {
        assert.deepEqual(body, { jobId: job.jobId, sequence: 0 });
        return Response.json({ sequence: 0 });
      },
      extras,
    );
    assert.deepEqual(await unchanged.json(), {
      unchanged: true,
      revision: header.revision,
    });
    const saved: AudioProject = {
      ...job.project,
      status: "running",
      progress: 25,
    };
    const changed = await audioEditorState(
      database,
      header,
      header.revision,
      async () => {
        await applyAudioEvent(
          database,
          job.id,
          job.jobId,
          { sequence: 1, project: saved },
          job.token,
        );
        return Response.json({ sequence: 0 });
      },
      extras,
    );
    const value = (await changed.json()) as any;
    assert.equal(value.project.progress, 25);
    assert.equal(value.project.revision, header.revision + 1);
    assert.equal(extraCalls, 0);
    await assert.rejects(
      audioEditorHeader(database, project.edition, project.book, "development"),
      /not found/,
    );
  } finally {
    sqlite.close();
  }
});

test("editing cleanup persists approvals and final audio and fences concurrent changes", async () => {
  const { sqlite, database, project } = fixture();
  try {
    project.settings.voiceDefaultsVersion = 1;
    project.settings.inheritBaseVoice = false;
    project.status = "done";
    project.chapters["1"] = { file: "65-jude-1.mp3", revision: "final" };
    project.recordings["1:1"] = {
      file: "jude/1-1-old/intro.wav",
      revision: "old",
      duration: 2,
    };
    project.settings.trims["1:1"] = { startSeconds: 0.1, endSeconds: 1.8 };
    project.settings.approvals = {
      "1:1": audioVerseApproval(project, project.settings, "1:1")!,
    };
    await insertAudioProjects(database, [project]);
    await assert.rejects(
      beginAudioJob(
        database,
        project.edition,
        project.book,
        "production",
        undefined,
        project.revision + 1,
      ),
      /changed/,
    );
    const job = await beginAudioJob(
      database,
      project.edition,
      project.book,
      "production",
      undefined,
      project.revision,
    );
    await assert.rejects(
      saveAudioProject(database, project.edition, project.book, {
        revision: job.project.revision,
        settings: job.project.settings,
      }),
      /Wait/,
    );
    const cleaned: AudioProject = structuredClone(job.project);
    cleaned.status = "done";
    cleaned.recordings = {};
    cleaned.settings.trims = {};
    cleaned.settings.approvals!["1:1"].editingFilesRemoved = true;
    assert.equal(
      (
        await applyAudioEvent(database, job.id, job.jobId, {
          sequence: 1,
          project: cleaned,
        })
      ).applied,
      true,
    );
    const stored = (
      await findAudioProject(database, project.edition, project.book)
    ).project;
    assert.deepEqual(stored.recordings, {});
    assert.deepEqual(stored.chapters, project.chapters);
    assert.equal(isAudioVerseApproved(stored, stored.settings, "1:1"), true);
    const saved = await saveAudioProject(
      database,
      project.edition,
      project.book,
      {
        revision: stored.revision,
        settings: stored.settings,
      },
    );
    assert.deepEqual(saved.chapters, project.chapters);
    assert.equal(isAudioVerseApproved(saved, saved.settings, "1:1"), true);
  } finally {
    sqlite.close();
  }
});
