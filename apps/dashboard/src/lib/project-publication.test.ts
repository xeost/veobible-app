import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  projectPublicationSchema,
  ProjectPublicationError,
  updateProjectPublication,
} from "./project-publication";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE video_projects(id INTEGER PRIMARY KEY,kind TEXT,published INTEGER,updated_at TEXT,settings TEXT);
    INSERT INTO video_projects VALUES(1,'short',0,'old','settings-one'),(2,'short',1,'old','settings-two'),(3,'long',0,'old','settings-three'),(4,'short',0,'old','settings-four');`);
  let calls = 0;
  const database = {
    prepare(query: string) {
      calls++;
      return {
        bind(...args: unknown[]) {
          return {
            async all() {
              return { results: sqlite.prepare(query).all(...(args as any[])) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { sqlite, database, calls: () => calls };
}

test("publication updates only the selected format and IDs in one operation, preserving other project data", async () => {
  const { sqlite, database, calls } = fixture();
  try {
    const input = projectPublicationSchema.parse({
      kind: "short",
      ids: [1, 2, 1],
      published: true,
    });
    assert.deepEqual(await updateProjectPublication(database, input, []), {
      updated: 2,
    });
    assert.equal(calls(), 1);
    assert.deepEqual(
      sqlite
        .prepare("SELECT id,published,settings FROM video_projects ORDER BY id")
        .all()
        .map((row) => [row.id, row.published, row.settings]),
      [
        [1, 1, "settings-one"],
        [2, 1, "settings-two"],
        [3, 0, "settings-three"],
        [4, 0, "settings-four"],
      ],
    );
    assert.notEqual(
      sqlite.prepare("SELECT updated_at FROM video_projects WHERE id=1").get()
        ?.updated_at,
      "old",
    );
    assert.equal(
      sqlite.prepare("SELECT updated_at FROM video_projects WHERE id=4").get()
        ?.updated_at,
      "old",
    );
    await updateProjectPublication(
      database,
      { kind: "short", ids: [1, 2], published: false },
      [],
    );
    await updateProjectPublication(
      database,
      { kind: "long", ids: [3], published: true },
      [],
    );
    assert.deepEqual(
      sqlite
        .prepare("SELECT published FROM video_projects ORDER BY id")
        .all()
        .map((row) => row.published),
      [0, 0, 1, 0],
    );
  } finally {
    sqlite.close();
  }
});

test("missing IDs and mixed formats reject the entire selection without partial publication changes", async () => {
  const { sqlite, database } = fixture();
  try {
    for (const ids of [
      [1, 999],
      [1, 3],
    ]) {
      await assert.rejects(
        updateProjectPublication(
          database,
          { kind: "short", ids, published: true },
          [],
        ),
        (cause) =>
          cause instanceof ProjectPublicationError && cause.status === 404,
      );
      assert.equal(
        sqlite.prepare("SELECT published FROM video_projects WHERE id=1").get()
          ?.published,
        0,
      );
      assert.equal(
        sqlite.prepare("SELECT updated_at FROM video_projects WHERE id=1").get()
          ?.updated_at,
        "old",
      );
    }
  } finally {
    sqlite.close();
  }
});

test("queued or running video generation blocks the whole batch; unrelated work does not", async () => {
  const { sqlite, database, calls } = fixture();
  try {
    const input = { kind: "short" as const, ids: [1, 2], published: true };
    for (const status of ["queued", "running"]) {
      await assert.rejects(
        updateProjectPublication(database, input, [
          { projectId: 2, kind: "short", type: "video", status },
        ]),
        (cause) =>
          cause instanceof ProjectPublicationError && cause.status === 409,
      );
    }
    assert.equal(calls(), 0);
    assert.deepEqual(
      await updateProjectPublication(database, input, [
        {
          projectId: null,
          kind: "voice-sample",
          type: "voice-sample",
          status: "running",
        },
        { projectId: 1, kind: "short", type: "alignment", status: "running" },
        { projectId: 1, kind: "short", type: "intro", status: "queued" },
        { projectId: 1, kind: "long", type: "video", status: "running" },
        { projectId: 4, kind: "short", type: "video", status: "running" },
        { projectId: 2, kind: "short", type: "video", status: "done" },
      ]),
      { updated: 2 },
    );
  } finally {
    sqlite.close();
  }
});

test("a complete 100-row page fits in one statement; invalid bulk requests are rejected", async () => {
  const { sqlite, database, calls } = fixture();
  try {
    for (let id = 5; id <= 104; id++)
      sqlite
        .prepare("INSERT INTO video_projects VALUES(?,'short',0,'old','{}')")
        .run(id);
    const input = projectPublicationSchema.parse({
      kind: "short",
      ids: Array.from({ length: 100 }, (_, index) => index + 5),
      published: true,
    });
    assert.deepEqual(await updateProjectPublication(database, input, []), {
      updated: 100,
    });
    assert.equal(calls(), 1);
    for (const patch of [
      { ids: [] },
      { ids: [0] },
      { ids: [1.5] },
      { ids: ["1"] },
      { ids: Array(101).fill(1) },
      { kind: "other" },
      { published: "true" },
      { published: undefined },
    ]) {
      assert.equal(
        projectPublicationSchema.safeParse({ ...input, ...patch }).success,
        false,
      );
    }
  } finally {
    sqlite.close();
  }
});
