import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  emptyPublicationSettings,
  loadPublicationSettings,
  savePublicationSettings,
  publicationSettingsSchema,
} from "./publication-settings";

test("publication settings have no seeded copy and are independent by format and language", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(
      "CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)",
    );
    const database = {
      prepare: (query: string) => ({
        bind: (...values: any[]) => ({
          first: async () => sqlite.prepare(query).get(...values) ?? null,
          run: async () => sqlite.prepare(query).run(...values),
        }),
      }),
    } as unknown as D1Database;
    for (const kind of ["short", "long"] as const)
      assert.deepEqual(
        await loadPublicationSettings(database, kind),
        emptyPublicationSettings(kind),
      );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) n FROM site_settings").get()?.n,
      0,
    );
    const short = emptyPublicationSettings("short"),
      long = emptyPublicationSettings("long");
    short.en.instagram = "Short {title}\n\n{hashtags}";
    short.es.facebook = "{passage}";
    long.pt.youtube = "Dia {episode}: {reference} — {version}\n{passage_url}";
    await savePublicationSettings(database, "short", short);
    await savePublicationSettings(database, "long", long);
    assert.deepEqual(await loadPublicationSettings(database, "short"), short);
    assert.deepEqual(await loadPublicationSettings(database, "long"), long);
    await savePublicationSettings(
      database,
      "short",
      emptyPublicationSettings("short"),
    );
    assert.deepEqual(await loadPublicationSettings(database, "long"), long);
    assert.equal(
      publicationSettingsSchema("long").safeParse({
        ...long,
        en: { instagram: "Unsupported" },
      }).success,
      false,
    );
    for (const template of [
      "{unknown}",
      "{title",
      "{title}}",
      "a".repeat(20001),
    ]) {
      assert.equal(
        publicationSettingsSchema("short").safeParse({
          ...short,
          en: { youtube: template },
        }).success,
        false,
      );
    }
    assert.deepEqual(
      await loadPublicationSettings(database, "short"),
      emptyPublicationSettings("short"),
    );
  } finally {
    sqlite.close();
  }
});
