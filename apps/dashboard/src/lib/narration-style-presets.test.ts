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
      settings: {
        ...narrationPresets.expressive,
        temperature: 0.6,
        modelSettings: { "future-model": { nested: { pace: 0.7 } } },
      },
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

test("one style keeps independent configurations for both Qwen sizes, Chatterbox and future models", async () => {
  const { qwenDefaults } =
    await import("../../../../tools/video-project-api/src/narration-model-settings");
  const { effectiveNarrationParameters, narrationParameterArgs } =
    await import("./narration-parameters");
  const { narrationPresetSelectionSchema } =
    await import("./voice-style-presets");
  const { presetSettings } = await import("./narration-style-presets");
  const library = presetLibraryFromStyles(defaultNarrationStyles());
  library.es.items.push({
    id: "solemn",
    name: "Solemn",
    settings: {
      ...narrationPresets.natural,
      modelSettings: {
        "multilingual-v3": {
          ...narrationPresets.expressive,
          temperature: 0.65,
        },
        "qwen3-base-0.6b": { ...qwenDefaults, top_k: 25 },
        "qwen3-base-1.7b": { ...qwenDefaults, top_p: 0.8 },
        "future-voice": { nested: { pace: 0.9 }, flags: ["a", "b"] },
      },
    },
  });
  library.es.selected = "solemn";
  const reloaded = narrationPresetLibrarySchema.parse(
    JSON.parse(JSON.stringify(library)),
  );
  const styles = stylesFromPresetLibrary(reloaded);
  const parameters = resolveNarrationStyle(styles.es);
  assert.equal(
    effectiveNarrationParameters(parameters, "multilingual-v3").temperature,
    0.65,
  );
  const small = effectiveNarrationParameters(parameters, "qwen3-base-0.6b");
  assert.deepEqual(small, { ...qwenDefaults, top_k: 25 });
  assert.deepEqual(
    effectiveNarrationParameters(parameters, "qwen3-base-1.7b"),
    { ...qwenDefaults, top_p: 0.8 },
  );
  const args = narrationParameterArgs(parameters, "qwen3-base-1.7b");
  assert.equal(args.includes("--exaggeration"), false);
  assert.equal(args.includes("--cfg-weight"), false);
  assert.equal(args.includes("--model-settings"), false);
  assert.equal(args[args.indexOf("--top-p") + 1], "0.8");
  // A project snapshots the complete style, so later model changes preserve its choices.
  const snapshot = narrationPresetSelectionSchema.parse({
    id: "solemn",
    name: "Solemn",
    settings: presetSettings(reloaded, "es", "solemn"),
  });
  assert.deepEqual(snapshot.settings.modelSettings?.["future-voice"], {
    nested: { pace: 0.9 },
    flags: ["a", "b"],
  });
  assert.deepEqual(snapshot.settings, parameters);
});

test("built-in styles accept model-specific settings without changing their identities or other languages", async () => {
  const { qwenDefaults } =
    await import("../../../../tools/video-project-api/src/narration-model-settings");
  const { effectiveNarrationParameters } =
    await import("./narration-parameters");
  const { presetSettings } = await import("./narration-style-presets");
  const library = presetLibraryFromStyles(defaultNarrationStyles());
  library.en.builtInSettings = {
    natural: {
      "qwen3-base-0.6b": { ...qwenDefaults, temperature: 0.55 },
      "qwen3-base-1.7b": { ...qwenDefaults, top_k: 40 },
    },
  };
  const parsed = narrationPresetLibrarySchema.parse(
    JSON.parse(JSON.stringify(library)),
  );
  assert.equal(parsed.en.selected, "natural");
  assert.deepEqual(parsed.en.items, []);
  const parameters = resolveNarrationStyle(stylesFromPresetLibrary(parsed).en);
  assert.deepEqual(parameters, presetSettings(parsed, "en", "natural"));
  assert.deepEqual(
    effectiveNarrationParameters(parameters, "multilingual-v3"),
    narrationPresets.natural,
  );
  assert.equal(
    effectiveNarrationParameters(parameters, "qwen3-base-0.6b").temperature,
    0.55,
  );
  assert.deepEqual(stylesFromPresetLibrary(parsed).es, { preset: "natural" });
  const bad = structuredClone(parsed);
  bad.en.builtInSettings!.natural!["qwen3-base-0.6b"].top_k = -1;
  assert.equal(narrationPresetLibrarySchema.safeParse(bad).success, false);
});
