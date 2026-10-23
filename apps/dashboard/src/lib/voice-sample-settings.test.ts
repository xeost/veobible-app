import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultNarrationModels } from "./narration-models";
import {
  defaultNarrationStyles,
  narrationPresets,
} from "./narration-parameters";
import {
  presetLibraryFromStyles,
  stylesFromPresetLibrary,
} from "./narration-style-presets";
import {
  resolveVoiceSampleSettings,
  voiceSampleRequestSchema,
} from "./voice-sample-settings";

test("sample previews use the current preset, model and decoder for each language", () => {
  const presets = presetLibraryFromStyles(defaultNarrationStyles());
  presets.es.items.push({
    id: "test-style",
    name: "Test style",
    settings: {
      ...narrationPresets.natural,
      exaggeration: 0.9,
      repetition_penalty: 1.4,
    },
  });
  presets.es.selected = "test-style";
  presets.pt.selected = "relaxed";
  const input = voiceSampleRequestSchema.parse({
    text: "  Example narration  ",
    narrationSettings: {
      models: {
        ...defaultNarrationModels(),
        es: "latam",
        pt: "pt-br",
        decoders: { es: { latam: "v3" } },
      },
      styles: stylesFromPresetLibrary(presets),
    },
  });
  assert.equal(input.text, "Example narration");
  assert.deepEqual(resolveVoiceSampleSettings("es", input.narrationSettings!), {
    voiceModel: "latam",
    voiceDecoder: "v3",
    voiceParameters: presets.es.items[0].settings,
  });
  assert.deepEqual(resolveVoiceSampleSettings("pt", input.narrationSettings!), {
    voiceModel: "pt-br",
    voiceDecoder: "v3",
    voiceParameters: narrationPresets.relaxed,
  });
  assert.deepEqual(
    resolveVoiceSampleSettings("en", input.narrationSettings!).voiceParameters,
    narrationPresets.natural,
  );
});

test("existing sample requests keep saved narration choices and reading overrides", () => {
  assert.deepEqual(voiceSampleRequestSchema.parse({ text: "Example" }), {
    text: "Example",
  });
  const input = voiceSampleRequestSchema.parse({
    text: "Reading",
    kind: "short",
    role: "reading",
    readingParameters: {
      exaggeration: 0.2,
      cfg_weight: 0.1,
      temperature: 0.6,
      repetition_penalty: 1.5,
    },
  });
  const settings = {
    models: defaultNarrationModels(),
    styles: defaultNarrationStyles(),
  };
  assert.deepEqual(
    resolveVoiceSampleSettings("es", settings, input.readingParameters),
    {
      voiceModel: "multilingual-v3",
      voiceDecoder: "general",
      voiceParameters: {
        ...narrationPresets.natural,
        ...input.readingParameters,
      },
    },
  );
  assert.equal(
    voiceSampleRequestSchema.safeParse({ text: "Example", role: "reading" })
      .success,
    false,
  );
});

test("sample previews reject unsupported language models and invalid preset parameters", () => {
  const narrationSettings = {
    models: defaultNarrationModels(),
    styles: defaultNarrationStyles(),
  };
  assert.equal(
    voiceSampleRequestSchema.safeParse({
      text: "Example",
      narrationSettings: {
        ...narrationSettings,
        models: { ...narrationSettings.models, en: "latam" },
      },
    }).success,
    false,
  );
  assert.equal(
    voiceSampleRequestSchema.safeParse({
      text: "Example",
      narrationSettings: {
        ...narrationSettings,
        styles: {
          ...narrationSettings.styles,
          es: {
            preset: "custom",
            exaggeration: 9,
            cfg_weight: 0.3,
            temperature: 0.8,
          },
        },
      },
    }).success,
    false,
  );
  assert.equal(
    voiceSampleRequestSchema.safeParse({ text: " " }).success,
    false,
  );
});

test("voice samples forward the current Spanish model's text adaptations", () => {
  const settings = {
    models: {
      ...defaultNarrationModels(),
      textAdaptations: {
        es: { "multilingual-v3": { reinforceSpanishRs: true } },
      },
    },
    styles: defaultNarrationStyles(),
  };
  assert.deepEqual(
    resolveVoiceSampleSettings("es", settings).voiceTextAdaptations,
    { reinforceSpanishRs: true },
  );
  assert.equal(
    resolveVoiceSampleSettings("en", settings).voiceTextAdaptations,
    undefined,
  );
});
