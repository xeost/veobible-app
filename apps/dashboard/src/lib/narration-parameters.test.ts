import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  defaultNarrationStyles,
  loadNarrationStyles,
  saveNarrationGenerationSettings,
  resolveNarrationStyle,
  narrationStylesSchema,
  loadReadingNarrationOverrides,
  defaultReadingNarrationOverrides,
  resolveReadingNarrationParameters,
  readingNarrationOverridesSchema,
} from "./narration-parameters";
import {
  saveBaseVoiceDefaults,
  defaultBaseVoices,
  loadBaseVoiceDefaults,
} from "./base-voices";
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

test("reading overrides are optional, isolated by format/language and saved atomically with voice choices", async () => {
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
    assert.deepEqual(
      await loadReadingNarrationOverrides(db, "short"),
      defaultReadingNarrationOverrides(),
    );
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) n FROM site_settings").get()?.n,
      0,
    );
    const reading = {
      exaggeration: 0.2,
      cfg_weight: 0,
      temperature: 0.6,
      repetition_penalty: 1.5,
    };
    const short = { ...defaultReadingNarrationOverrides(), es: reading };
    await saveBaseVoiceDefaults(db, "short", defaultBaseVoices(), short);
    await saveBaseVoiceDefaults(db, "long", defaultBaseVoices(), {
      ...defaultReadingNarrationOverrides(),
      en: { ...reading, temperature: 1.1 },
    });
    assert.deepEqual(await loadReadingNarrationOverrides(db, "short"), short);
    const long = await loadReadingNarrationOverrides(db, "long");
    assert.equal(long.en?.temperature, 1.1);
    assert.equal(long.es, null);
    const general = resolveNarrationStyle({ preset: "expressive" });
    assert.deepEqual(resolveReadingNarrationParameters(general, reading), {
      ...general,
      ...reading,
    });
    assert.deepEqual(
      resolveReadingNarrationParameters(general, short.en),
      general,
    );
    assert.equal(general.exaggeration, 0.7);
    for (const [key, invalid] of [
      ["exaggeration", 2.1],
      ["cfg_weight", -0.1],
      ["temperature", 0],
      ["repetition_penalty", 2.1],
      ["top_p", 0.5],
    ]) {
      await assert.rejects(
        saveBaseVoiceDefaults(
          db,
          "short",
          { ...defaultBaseVoices(), es: "es-2" },
          { ...short, es: { ...reading, [key as string]: invalid } },
        ),
      );
    }
    assert.equal((await loadBaseVoiceDefaults(db, "short")).es.reading, "es-1");
    assert.deepEqual(await loadReadingNarrationOverrides(db, "short"), short);
    await saveBaseVoiceDefaults(db, "short", defaultBaseVoices(), {
      ...short,
      es: null,
    });
    const disabled = await loadReadingNarrationOverrides(db, "short");
    const changedGeneral = resolveNarrationStyle({ preset: "relaxed" });
    assert.deepEqual(
      resolveReadingNarrationParameters(changedGeneral, disabled.es),
      changedGeneral,
    );
    assert.throws(() =>
      readingNarrationOverridesSchema.parse({ ...short, fr: reading }),
    );
  } finally {
    sqlite.close();
  }
});
