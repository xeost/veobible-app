import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  defaultNarrationStyles,
  loadNarrationStyles,
  saveNarrationGenerationSettings,
  resolveNarrationStyle,
  narrationStylesSchema,
} from "./narration-parameters";
import {
  defaultNarrationModels,
  loadNarrationModels,
} from "./narration-models";

test("voice styles default without changing saved model choices and persist by language", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)",
  );
  const db = {
    prepare: (query: string) => ({
      bind: (...values: any[]) => ({
        first: async () => sqlite.prepare(query).get(...values) ?? null,
        run: async () => sqlite.prepare(query).run(...values),
      }),
    }),
    batch: async (statements: any[]) => {
      sqlite.exec("BEGIN");
      try {
        for (const statement of statements) await statement.run();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  try {
    const models = { ...defaultNarrationModels(), en: "chatterbox" };
    sqlite
      .prepare("INSERT INTO site_settings VALUES (?,?,?)")
      .run("voice_generation_models", JSON.stringify(models), "before");
    assert.deepEqual(await loadNarrationStyles(db), defaultNarrationStyles());
    assert.deepEqual(await loadNarrationModels(db), models);
    assert.equal(
      sqlite.prepare("SELECT count(*) n FROM site_settings").get()?.n,
      1,
    );
    const styles = narrationStylesSchema.parse({
      en: { preset: "expressive" },
      es: { preset: "relaxed" },
      pt: {
        preset: "custom",
        exaggeration: 0.65,
        cfg_weight: 0,
        temperature: 1.1,
        repetition_penalty: 2,
      },
    });
    await saveNarrationGenerationSettings(db, { models, styles });
    assert.deepEqual(await loadNarrationStyles(db), styles);
    assert.deepEqual(resolveNarrationStyle(styles.en), {
      exaggeration: 0.7,
      cfg_weight: 0.3,
      temperature: 0.8,
      min_p: 0.05,
      top_p: 1,
      repetition_penalty: 1.2,
    });
    assert.equal(resolveNarrationStyle(styles.es).temperature, 0.7);
    assert.equal(resolveNarrationStyle(styles.pt).exaggeration, 0.65);
    assert.equal(
      resolveNarrationStyle((await loadNarrationStyles(db)).pt)
        .repetition_penalty,
      2,
    );
    for (const invalid of [NaN, Infinity, -0.01, 2.01]) {
      await assert.rejects(
        saveNarrationGenerationSettings(db, {
          models: defaultNarrationModels(),
          styles: { ...styles, pt: { ...styles.pt, exaggeration: invalid } },
        }),
      );
    }
    await assert.rejects(
      saveNarrationGenerationSettings(db, {
        models,
        styles: { ...styles, en: { preset: "natural", temperature: 1 } },
      }),
    );
    assert.deepEqual(await loadNarrationModels(db), models);
    assert.deepEqual(await loadNarrationStyles(db), styles);
  } finally {
    sqlite.close();
  }
});
