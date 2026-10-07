import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
const directory = new URL("../../migrations/", import.meta.url);
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync(directory).sort())
    db.exec(readFileSync(new URL(file, directory), "utf8"));
  return db;
}
test("every passage/version has a durable draft with independent state", () => {
  const db = database();
  try {
    assert.deepEqual(
      db
        .prepare(
          "SELECT kind,count(*) total FROM catalog GROUP BY kind ORDER BY kind",
        )
        .all()
        .map((r) => ({ ...r })),
      [
        { kind: "long", total: 365 },
        { kind: "short", total: 100 },
      ],
    );
    assert.equal(
      db.prepare("SELECT count(*) total FROM projects").get()?.total,
      2325,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) total FROM projects WHERE status='draft'")
        .get()?.total,
      2325,
    );
    db.exec(
      "UPDATE projects SET status='ready' WHERE catalog_id='short:john-3-14-19' AND version_id='rv1909'",
    );
    assert.equal(
      db
        .prepare(
          "SELECT count(*) total FROM projects WHERE catalog_id='short:john-3-14-19' AND status='draft'",
        )
        .get()?.total,
      4,
    );
    const before = db
      .prepare("SELECT id FROM projects ORDER BY id LIMIT 1")
      .get()?.id;
    db.exec(
      readFileSync(new URL("0008_project_settings.sql", directory), "utf8"),
    );
    assert.equal(
      db.prepare("SELECT id FROM projects ORDER BY id LIMIT 1").get()?.id,
      before,
    );
    assert.equal(
      db.prepare("SELECT count(*) total FROM projects").get()?.total,
      2325,
    );
  } finally {
    db.close();
  }
});
test("D1 schema rejects concurrent renders but retains terminal history", () => {
  const db = database();
  try {
    const p = db.prepare("SELECT id FROM projects LIMIT 1").get()?.id;
    const insert = db.prepare(
      "INSERT INTO jobs(id,project_id,status,snapshot,callback_hash) VALUES (?,?,'queued','{}','hash')",
    );
    insert.run("first", p as string);
    assert.throws(() => insert.run("second", p as string), /UNIQUE/);
    db.exec(
      "UPDATE jobs SET status='failed',error='Interrupted' WHERE id='first'",
    );
    insert.run("second", p as string);
    assert.equal(db.prepare("SELECT count(*) total FROM jobs").get()?.total, 2);
    assert.throws(
      () => db.exec("UPDATE projects SET settings='invalid-json'"),
      /CHECK/,
    );
  } finally {
    db.close();
  }
});
