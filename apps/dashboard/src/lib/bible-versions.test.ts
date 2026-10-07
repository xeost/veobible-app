import { renderSchema } from "./video-schema";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  syncBibleVersions,
  saveBibleVersion,
  listBibleVersions,
  deleteBibleVersion,
  bibleVersionSchema,
  BibleVersionError,
} from "./bible-versions";

test("Bible version CRUD isolates languages and protects existing projects", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../../migrations/0001_dashboard.sql", import.meta.url),
      "utf8",
    ),
  );
  const database = {
    prepare(query: string) {
      let parameters: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          parameters = values;
          return statement;
        },
        async first() {
          return sqlite.prepare(query).get(...(parameters as any[])) ?? null;
        },
        async all() {
          return {
            results: sqlite.prepare(query).all(...(parameters as any[])),
          };
        },
        async run() {
          const result = sqlite.prepare(query).run(...(parameters as any[]));
          return {
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  try {
    assert.deepEqual(await listBibleVersions(database), []);
    assert.equal(
      renderSchema.shape.version.parse({
        id: "custom-2026",
        locale: "es",
        label: "Custom",
      }).id,
      "custom-2026",
    );
    assert.throws(() =>
      renderSchema.shape.version.parse({
        id: "../unsafe",
        locale: "es",
        label: "Unsafe",
      }),
    );
    const spanish = await saveBibleVersion(database, {
      locale: "es",
      code: "shared",
      label: " Spanish ",
    });
    assert.equal(spanish?.id, 1);
    assert.equal(spanish?.label, "Spanish");
    const english = await saveBibleVersion(database, {
      locale: "en",
      code: "shared",
      label: "English",
    });
    assert.equal(english?.id, 2);
    await assert.rejects(
      saveBibleVersion(database, {
        locale: "es",
        code: "shared",
        label: "Duplicate",
      }),
      (error) => error instanceof BibleVersionError && error.status === 409,
    );
    await saveBibleVersion(
      database,
      { locale: "pt", code: "other", label: "Portuguese" },
      english!.id,
    );
    sqlite
      .prepare(
        "INSERT INTO video_projects(kind,bible_version_id,passage_id,title,passage) VALUES ('short',?,'passage','Video','{}')",
      )
      .run(spanish!.id);
    assert.equal(
      (await listBibleVersions(database)).find((row) => row.id === spanish!.id)
        ?.project_count,
      1,
    );
    await saveBibleVersion(
      database,
      { locale: "es", code: "shared", label: "Renamed" },
      spanish!.id,
    );
    await assert.rejects(
      saveBibleVersion(
        database,
        { locale: "es", code: "changed", label: "Renamed" },
        spanish!.id,
      ),
      BibleVersionError,
    );
    await assert.rejects(
      saveBibleVersion(
        database,
        { locale: "en", code: "shared", label: "Renamed" },
        spanish!.id,
      ),
      BibleVersionError,
    );
    await assert.rejects(
      deleteBibleVersion(database, spanish!.id),
      BibleVersionError,
    );
    await deleteBibleVersion(database, english!.id);
    assert.equal((await listBibleVersions(database)).length, 1);
    await assert.rejects(
      deleteBibleVersion(database, english!.id),
      (error) => error instanceof BibleVersionError && error.status === 404,
    );
    for (const code of ["../bad", "UPPER", "two words", "", "-start"])
      assert.equal(
        bibleVersionSchema.safeParse({ locale: "es", code, label: "Test" })
          .success,
        false,
      );
  } finally {
    sqlite.close();
  }
});

test("version synchronization adds only missing language and code pairs and never updates or deletes", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../../migrations/0001_dashboard.sql", import.meta.url),
      "utf8",
    ),
  );
  const database = {
    prepare(query: string) {
      return {
        bind(...values: any[]) {
          return {
            async run() {
              return {
                meta: {
                  changes: Number(sqlite.prepare(query).run(...values).changes),
                },
              };
            },
          };
        },
      };
    },
    async batch(statements: { run: () => Promise<unknown> }[]) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  } as unknown as D1Database;
  try {
    sqlite.exec(
      "INSERT INTO bible_versions(locale,code,label) VALUES ('es','same','Custom name'),('pt','old','Preserved version')",
    );
    const available = [
      { locale: "es", code: "same", label: "Changed upstream" },
      { locale: "en", code: "same", label: "English" },
      { locale: "es", code: "new", label: "New" },
      { locale: "es", code: "new", label: "Duplicate" },
    ];
    assert.deepEqual(await syncBibleVersions(database, available), {
      added: 2,
    });
    assert.equal(
      sqlite.prepare("SELECT label FROM bible_versions WHERE id=1").get()
        ?.label,
      "Custom name",
    );
    assert.equal(
      sqlite.prepare("SELECT count(*) total FROM bible_versions").get()?.total,
      4,
    );
    assert.deepEqual(await syncBibleVersions(database, available), {
      added: 0,
    });
    assert.deepEqual(await syncBibleVersions(database, []), { added: 0 });
    await assert.rejects(
      syncBibleVersions(database, [
        { locale: "es", code: "valid", label: "Valid" },
        { locale: "es", code: "../bad", label: "Bad" },
      ]),
    );
    assert.equal(
      sqlite.prepare("SELECT count(*) total FROM bible_versions").get()?.total,
      4,
    );
  } finally {
    sqlite.close();
  }
});
