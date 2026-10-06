import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { videoCatalogId } from "./video-routing";

test("encoded and decoded editor URLs resolve the same saved project and version", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const directory = new URL("../../migrations/", import.meta.url);
    for (const file of readdirSync(directory).sort())
      db.exec(readFileSync(new URL(file, directory), "utf8"));
    for (const kind of ["short", "long"]) {
      const catalog = db
        .prepare(
          "SELECT id FROM catalog WHERE kind=? ORDER BY position LIMIT 1",
        )
        .get(kind)!;
      const id = String(catalog.id);
      for (const param of [id, encodeURIComponent(id)]) {
        const normalized = videoCatalogId(param);
        // This is the API path encoding and decoding performed by the editor and handler.
        const request = new URL(
          `https://dashboard.example/api/videos/${encodeURIComponent(normalized)}?version=rv1909`,
        );
        const lookupId = decodeURIComponent(
          request.pathname.slice("/api/videos/".length),
        );
        const project = db
          .prepare(
            "SELECT p.id,c.kind,p.version_id FROM projects p JOIN catalog c ON c.id=p.catalog_id WHERE c.id=? AND p.version_id=?",
          )
          .get(lookupId, request.searchParams.get("version"));
        assert.ok(project);
        assert.equal(project.kind, kind);
        assert.equal(project.version_id, "rv1909");
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
