import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  narrationPresetLibrarySchema,
  presetLibraryFromStyles,
  stylesFromPresetLibrary,
} from "./narration-style-presets";
import {
  defaultNarrationStyles,
  narrationPresets,
  resolveNarrationStyle,
  loadNarrationPresetLibrary,
  loadNarrationStyles,
  saveNarrationGenerationSettings,
} from "./narration-parameters";
import { defaultNarrationModels } from "./narration-models";

test("custom styles become editable presets without losing their settings", () => {
  const styles = defaultNarrationStyles();
  styles.es = {
    preset: "custom",
    exaggeration: 0.9,
    cfg_weight: 0.2,
    temperature: 1,
    repetition_penalty: 1.5,
  };
  const library = presetLibraryFromStyles(styles);
  assert.equal(library.es.items.length, 1);
  assert.equal(library.es.selected, library.es.items[0].id);
  assert.deepEqual(library.en.items, []);
  assert.deepEqual(library.pt.items, []);
  assert.deepEqual(stylesFromPresetLibrary(library), styles);
});

test("presets persist per language and selected values reach narration generation", async () => {
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
    const presets = await loadNarrationPresetLibrary(db);
    presets.es.items.push({
      id: "solemn",
      name: "Solemne",
      settings: { ...narrationPresets.expressive, temperature: 0.6 },
    });
    presets.es.selected = "solemn";
    presets.pt.items.push({
      id: "solemn",
      name: "Solene",
      settings: { ...narrationPresets.relaxed },
    });
    presets.pt.selected = "solemn";
    const input = {
      models: defaultNarrationModels(),
      styles: defaultNarrationStyles(),
      presets,
    };
    await saveNarrationGenerationSettings(db, input);
    assert.deepEqual(await loadNarrationPresetLibrary(db), presets);
    assert.deepEqual(
      resolveNarrationStyle((await loadNarrationStyles(db)).es),
      presets.es.items[0].settings,
    );
    assert.deepEqual(
      resolveNarrationStyle((await loadNarrationStyles(db)).pt),
      narrationPresets.relaxed,
    );
    assert.deepEqual((await loadNarrationStyles(db)).en, { preset: "natural" });
    presets.es.items[0].settings.temperature = 0.9;
    await saveNarrationGenerationSettings(db, input);
    assert.equal(
      resolveNarrationStyle((await loadNarrationStyles(db)).es).temperature,
      0.9,
    );
    assert.equal(
      resolveNarrationStyle((await loadNarrationStyles(db)).pt).temperature,
      0.7,
    );
    const invalid = structuredClone(presets);
    invalid.en.selected = "solemn";
    await assert.rejects(
      saveNarrationGenerationSettings(db, { ...input, presets: invalid }),
    );
    assert.deepEqual(await loadNarrationPresetLibrary(db), presets);
  } finally {
    sqlite.close();
  }
});

test("preset validation protects built-ins and rejects missing, duplicate or invalid custom styles", () => {
  const original = structuredClone(narrationPresets);
  for (const id of Object.keys(narrationPresets)) {
    const library = presetLibraryFromStyles(defaultNarrationStyles());
    library.en.items.push({
      id,
      name: "Changed built-in",
      settings: narrationPresets.relaxed,
    });
    assert.equal(
      narrationPresetLibrarySchema.safeParse(library).success,
      false,
    );
  }
  const library = presetLibraryFromStyles(defaultNarrationStyles());
  const preset = {
    id: "custom-one",
    name: "Custom one",
    settings: { ...narrationPresets.natural },
  };
  library.en.items.push(preset, preset);
  assert.equal(narrationPresetLibrarySchema.safeParse(library).success, false);
  library.en.items.pop();
  preset.settings.temperature = 6;
  assert.equal(narrationPresetLibrarySchema.safeParse(library).success, false);
  preset.settings.temperature = 0.8;
  preset.name = "  ";
  assert.equal(narrationPresetLibrarySchema.safeParse(library).success, false);
  assert.deepEqual(narrationPresets, original);
});
