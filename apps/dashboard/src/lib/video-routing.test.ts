import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { videoCatalogId } from "./video-routing";

test("numeric editor URLs resolve the saved video project", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const directory = new URL("../../migrations/", import.meta.url);
    for (const file of readdirSync(directory).sort())
      db.exec(readFileSync(new URL(file, directory), "utf8"));
    db.exec(
      "INSERT INTO bible_versions(locale,code,label) VALUES ('es','rv1909','Reina Valera')",
    );
    for (const kind of ["short", "long"]) {
      const creation = db
        .prepare(
          "INSERT INTO video_projects(kind,bible_version_id,slug,title,passage) VALUES (?,1,?,'Test','{}')",
        )
        .run(kind, kind);
      const id = String(creation.lastInsertRowid);
      for (const param of [id, encodeURIComponent(id)]) {
        const normalized = videoCatalogId(param);
        const project = db
          .prepare("SELECT id,kind FROM video_projects WHERE id=?")
          .get(normalized);
        assert.equal(project?.kind, kind);
      }
    }
    assert.equal(videoCatalogId("short%3Ajohn-3-14-19"), "short:john-3-14-19");
  } finally {
    db.close();
  }
});
test("malformed route encoding does not crash the page", () => {
  assert.equal(videoCatalogId("short%invalid"), "short%invalid");
});
