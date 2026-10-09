import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { listVideoProjects, nextVideoProject } from "./video-listing";
import {
  parseCurrentProjects,
  toggleCurrentProjectMark,
  removeCurrentProject,
  advanceCurrentProjectMark,
  currentProjectStorageKey,
  projectVersionKey,
} from "./current-video-projects";

test("current project marks retain separate language and format scopes and reject invalid saved IDs", () => {
  assert.notEqual(
    currentProjectStorageKey("short"),
    currentProjectStorageKey("long"),
  );
  assert.notEqual(
    projectVersionKey({ locale: "es", version_code: "test" } as any),
    projectVersionKey({ locale: "en", version_code: "test" } as any),
  );
  assert.deepEqual(
    parseCurrentProjects('{"es:test":14,"en:test":23,"bad":-1,"text":"42"}'),
    { "es:test": [14], "en:test": [23] },
  );
  for (const input of [null, "broken", "[]", "null"])
    assert.deepEqual(parseCurrentProjects(input), {});
});

test("long projects retain two marks per language and version while shorts keep one", () => {
  const row = (id: number, locale = "es", version_code = "test") => ({
    id,
    locale,
    version_code,
  });
  let marks = parseCurrentProjects('{"es:test":14}', "long");
  marks = toggleCurrentProjectMark(marks, row(23), "long");
  assert.deepEqual(marks, { "es:test": [14, 23] });
  assert.deepEqual(toggleCurrentProjectMark(marks, row(32), "long"), marks);
  const otherVersion = toggleCurrentProjectMark(
    marks,
    row(42, "es", "other"),
    "long",
  );
  const otherLanguage = toggleCurrentProjectMark(
    otherVersion,
    row(43, "en"),
    "long",
  );
  assert.deepEqual(otherLanguage, {
    "es:test": [14, 23],
    "es:other": [42],
    "en:test": [43],
  });
  assert.deepEqual(removeCurrentProject(otherLanguage, row(14)), {
    "es:test": [23],
    "es:other": [42],
    "en:test": [43],
  });
  assert.deepEqual(toggleCurrentProjectMark(marks, row(14), "long"), {
    "es:test": [23],
  });
  assert.deepEqual(
    toggleCurrentProjectMark({ "es:test": [14] }, row(23), "short"),
    { "es:test": [23] },
  );
  assert.deepEqual(
    parseCurrentProjects('{"es:test":[14,14,-1,23,32]}', "long"),
    { "es:test": [14, 23] },
  );
  assert.deepEqual(parseCurrentProjects('{"es:test":[14,23]}', "short"), {
    "es:test": [14],
  });
  assert.deepEqual(
    parseCurrentProjects(JSON.stringify(otherLanguage), "long"),
    otherLanguage,
  );
});

test("marked project listings return only requested IDs in the matching format and version", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE bible_versions(id INTEGER,code TEXT,locale TEXT,label TEXT);
    CREATE TABLE video_projects(id INTEGER,kind TEXT,title TEXT,published INTEGER,updated_at TEXT,bible_version_id INTEGER);
    INSERT INTO bible_versions VALUES(1,'test','es','Test'),(2,'test','en','Test');
    INSERT INTO video_projects VALUES(1,'short','One',0,null,1),(2,'short','Two',1,null,2),(3,'long','Three',0,null,1),(4,'short','Four',0,null,1),(5,'long','Five',0,null,1),(6,'long','Six',0,null,2),(8,'long','Eight',0,null,1);`);
  const database = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async all() {
              return { results: sqlite.prepare(sql).all(...(values as any[])) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  try {
    const rows = await listVideoProjects(database, "short", "1", "1,2,3,999");
    assert.deepEqual(
      rows.map((row) => row.id),
      [1],
    );
    const allVersions = await listVideoProjects(
      database,
      "short",
      null,
      "1,2,3,999",
    );
    assert.deepEqual(
      allVersions.map((row) => row.id),
      [1, 2],
    );
    await assert.rejects(listVideoProjects(database, "short", null, "1,-2"));
    assert.equal((await nextVideoProject(database, 1))?.id, 4);
    assert.equal(await nextVideoProject(database, 4), null);
    assert.equal((await nextVideoProject(database, 3))?.id, 5);
    assert.equal((await nextVideoProject(database, 3, [5]))?.id, 8);
    assert.equal(await nextVideoProject(database, 5, [8]), null);
    assert.equal(await nextVideoProject(database, 2), null);
  } finally {
    sqlite.close();
  }
});

test("alternating long-project advances move only the chosen marker and survive browser persistence", () => {
  const row = (id: number) => ({ id, locale: "es", version_code: "rv1909" });
  let marks = { "es:rv1909": [201, 400], "en:kjv": [701, 800] };
  marks = advanceCurrentProjectMark(marks, row(201), row(202)) as typeof marks;
  assert.deepEqual(marks, { "es:rv1909": [202, 400], "en:kjv": [701, 800] });
  marks = advanceCurrentProjectMark(marks, row(400), row(401)) as typeof marks;
  marks = advanceCurrentProjectMark(marks, row(202), row(203)) as typeof marks;
  assert.deepEqual(parseCurrentProjects(JSON.stringify(marks), "long"), {
    "es:rv1909": [203, 401],
    "en:kjv": [701, 800],
  });
  assert.equal(advanceCurrentProjectMark(marks, row(203), row(401)), marks);
  assert.equal(advanceCurrentProjectMark(marks, row(202), row(204)), marks);
});
