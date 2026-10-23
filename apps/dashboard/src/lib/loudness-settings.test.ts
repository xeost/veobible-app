import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  loadLoudnessSettings,
  saveLoudnessSettings,
  loudnessSettingsSchema,
} from "./loudness-settings";
test("loudness defaults to -14 and persists independent language targets with only supported values", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)",
  );
  const database = {
    prepare: (sql: string) => ({
      bind: (...values: any[]) => ({
        first: async () => sqlite.prepare(sql).get(...values) ?? null,
        run: async () => sqlite.prepare(sql).run(...values),
      }),
    }),
  } as unknown as D1Database;
  try {
    assert.deepEqual(await loadLoudnessSettings(database), {
      es: -14,
      en: -14,
      pt: -14,
    });
    await saveLoudnessSettings(database, { es: -16, en: -14, pt: -16 });
    assert.deepEqual(await loadLoudnessSettings(database), {
      es: -16,
      en: -14,
      pt: -16,
    });
    assert.equal(
      loudnessSettingsSchema.safeParse({ es: -15, en: -14, pt: -16 }).success,
      false,
    );
    await assert.rejects(saveLoudnessSettings(database, { es: -14 }));
    assert.deepEqual(await loadLoudnessSettings(database), {
      es: -16,
      en: -14,
      pt: -16,
    });
  } finally {
    sqlite.close();
  }
});
