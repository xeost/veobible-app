import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  loadNarrationModels,
  saveNarrationModels,
  defaultNarrationModels,
  narrationModelsSchema,
  applyNarrationSelection,
  selectedNarrationDecoder,
} from "./narration-models";
import { localModelsSchema } from "./local-models";
test("voice models persist in one site setting independently of templates and enforce language compatibility", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
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
    } as unknown as D1Database;
    assert.deepEqual(await loadNarrationModels(db), defaultNarrationModels());
    assert.equal(
      sqlite.prepare("SELECT count(*) n FROM site_settings").get()?.n,
      0,
    );
    sqlite
      .prepare("INSERT INTO site_settings VALUES (?,?,?)")
      .run("voice_templates:short", "preserved", "before");
    const chosen = { en: "chatterbox", es: "latam", pt: "pt-br" };
    await saveNarrationModels(db, chosen);
    assert.deepEqual(await loadNarrationModels(db), chosen);
    const configured = { ...chosen, decoders: { es: { latam: "v3" } } };
    await saveNarrationModels(db, configured);
    const loaded = await loadNarrationModels(db);
    assert.deepEqual(loaded, configured);
    assert.equal(selectedNarrationDecoder(loaded, "es"), "v3");
    assert.equal(selectedNarrationDecoder(loaded, "en"), "general");
    assert.equal(
      selectedNarrationDecoder(narrationModelsSchema.parse(chosen), "es"),
      "general",
    );
    await assert.rejects(
      saveNarrationModels(db, {
        ...chosen,
        decoders: { es: { latam: "unknown" } },
      }),
    );
    await saveNarrationModels(db, chosen);
    await assert.rejects(saveNarrationModels(db, { ...chosen, en: "pt-br" }));
    assert.deepEqual(await loadNarrationModels(db), chosen);
    assert.equal(
      sqlite
        .prepare(
          "SELECT value FROM site_settings WHERE key='voice_templates:short'",
        )
        .get()?.value,
      "preserved",
    );
    assert.equal(
      narrationModelsSchema.safeParse({ ...chosen, es: "multilingual-v2" })
        .success,
      false,
    );
    await saveNarrationModels(db, defaultNarrationModels());
    assert.equal(
      sqlite
        .prepare(
          "SELECT count(*) n FROM site_settings WHERE key='voice_generation_models'",
        )
        .get()?.n,
      1,
    );
  } finally {
    sqlite.close();
  }
});
test("model inventory uses follow saved language selections in both formats", () => {
  const inventory = localModelsSchema.parse({
    checkedAt: new Date().toISOString(),
    models: [
      "chatterbox-v3",
      "chatterbox-original",
      "chatterbox-latam",
      "chatterbox-pt-br",
    ].map((variant, i) => ({
      id: `local-model-${i + 1}`,
      name: variant,
      variant,
      role: "voice",
      uses: [],
      repository: "test/model",
      revision: null,
      status: "downloaded",
      software: { name: "chatterbox-tts", version: "0.1.7" },
    })),
  });
  const selected = applyNarrationSelection(inventory, {
    en: "chatterbox",
    es: "multilingual-v3",
    pt: "pt-br",
  });
  assert.deepEqual(
    selected.models.map((m) => m.uses[0]?.languages ?? []),
    [["es"], ["en"], [], ["pt"]],
  );
  assert.ok(
    selected.models
      .filter((m) => m.uses.length)
      .every((m) => m.uses.length === 2),
  );
  assert.ok(inventory.models.every((m) => m.uses.length === 0));
});

test("decoder choices are independent for each language and model", () => {
  const models = narrationModelsSchema.parse({
    en: "multilingual-v3",
    es: "multilingual-v3",
    pt: "pt-br",
    decoders: {
      en: { "multilingual-v3": "v3", chatterbox: "general" },
      es: { "multilingual-v3": "general", latam: "v3" },
      pt: { "pt-br": "general" },
    },
  });
  assert.equal(selectedNarrationDecoder(models, "en"), "v3");
  assert.equal(selectedNarrationDecoder(models, "es"), "general");
  assert.equal(selectedNarrationDecoder(models, "pt"), "general");
  models.en = "chatterbox";
  models.es = "latam";
  assert.equal(selectedNarrationDecoder(models, "en"), "general");
  assert.equal(selectedNarrationDecoder(models, "es"), "v3");
});
