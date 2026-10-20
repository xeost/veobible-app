import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  defaultBaseVoices,
  loadBaseVoiceDefaults,
  saveBaseVoiceDefaults,
  projectBaseVoice,
  baseVoiceDefaultsSchema,
} from "./base-voices";
import { settingsSchema } from "./video-schema";

test("voice defaults are separate per format and never resolve an existing project's voice", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT)",
  );
  const database = {
    prepare: (query: string) => ({
      bind: (...values: any[]) => ({
        first: async () => sqlite.prepare(query).get(...values) ?? null,
        run: async () => sqlite.prepare(query).run(...values),
      }),
    }),
  } as unknown as D1Database;
  try {
    assert.deepEqual(
      await loadBaseVoiceDefaults(database, "short"),
      defaultBaseVoices(),
    );
    const legacy = settingsSchema.parse({});
    const original = settingsSchema.parse({ baseVoice: "es-2" });
    await saveBaseVoiceDefaults(database, "short", {
      es: "es-3",
      en: "en-2",
      pt: "pt-1",
    });
    assert.equal(
      (await loadBaseVoiceDefaults(database, "short")).es.intro,
      "es-3",
    );
    assert.equal(
      (await loadBaseVoiceDefaults(database, "long")).es.intro,
      "es-1",
    );
    const newProject = settingsSchema.parse({
      baseVoice: (await loadBaseVoiceDefaults(database, "short")).es.intro,
    });
    await saveBaseVoiceDefaults(database, "short", {
      es: "es-4",
      en: "en-1",
      pt: "pt-1",
    });
    assert.equal(projectBaseVoice(legacy, "es"), "es-1");
    assert.equal(projectBaseVoice(original, "es"), "es-2");
    const roles = settingsSchema.parse({
      baseVoice: "es-2",
      baseVoices: { intro: "es-3", outro: "es-4", reading: "es-5" },
    });
    assert.equal(projectBaseVoice(roles, "es", "intro"), "es-3");
    assert.equal(projectBaseVoice(roles, "es", "outro"), "es-4");
    assert.equal(projectBaseVoice(roles, "es", "reading"), "es-5");
    assert.equal(projectBaseVoice(newProject, "es"), "es-3");
    assert.throws(() =>
      baseVoiceDefaultsSchema.parse({ es: "en-2", en: "en-1", pt: "pt-1" }),
    );
    assert.throws(() => projectBaseVoice({ baseVoice: "en-2" }, "es"));
    assert.throws(() => settingsSchema.parse({ baseVoice: "../../escape" }));
  } finally {
    sqlite.close();
  }
});
