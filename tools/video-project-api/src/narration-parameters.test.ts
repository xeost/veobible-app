import { test } from "node:test";
import assert from "node:assert/strict";
import {
  narrationParametersSchema,
  narrationParameterArgs,
  narrationPresets,
} from "./narration-parameters.js";
import { renderSchema } from "./protocol.js";
test("voice parameters cross the request and CLI boundaries with all six explicit values", () => {
  for (const parameters of Object.values(narrationPresets)) {
    assert.deepEqual(
      renderSchema.shape.voiceParameters.parse(parameters),
      parameters,
    );
    assert.deepEqual(narrationParameterArgs(parameters), [
      "--exaggeration",
      String(parameters.exaggeration),
      "--cfg-weight",
      String(parameters.cfg_weight),
      "--temperature",
      String(parameters.temperature),
      "--min-p",
      "0.05",
      "--top-p",
      "1",
      "--repetition-penalty",
      "2",
    ]);
  }
  assert.deepEqual(narrationParameterArgs(), []);
  for (const [field, values] of Object.entries({
    exaggeration: [-0.01, 2.01],
    cfg_weight: [-0.01, 1.01],
    temperature: [0, 5.01],
    min_p: [0.1],
    top_p: [0.9],
    repetition_penalty: [0.99, 2.01],
  }))
    for (const value of values)
      assert.equal(
        narrationParametersSchema.safeParse({
          ...narrationPresets.natural,
          [field]: value,
        }).success,
        false,
      );
});

test("custom repetition penalty reaches generation and legacy custom settings retain 1.2", async () => {
  const { narrationStyleSchema, resolveNarrationStyle } =
    await import("./narration-parameters.js");
  const legacy = {
    preset: "custom",
    exaggeration: 0.5,
    cfg_weight: 0.5,
    temperature: 0.8,
  };
  assert.equal(
    resolveNarrationStyle(narrationStyleSchema.parse(legacy))
      .repetition_penalty,
    1.2,
  );
  const parameters = resolveNarrationStyle(
    narrationStyleSchema.parse({ ...legacy, repetition_penalty: 2 }),
  );
  assert.equal(
    renderSchema.shape.voiceParameters.parse(parameters)?.repetition_penalty,
    2,
  );
  assert.equal(narrationParameterArgs(parameters).at(-1), "2");
  for (const repetition_penalty of [0.99, 2.01, NaN, Infinity])
    assert.equal(
      narrationStyleSchema.safeParse({ ...legacy, repetition_penalty }).success,
      false,
    );
});

test("model settings survive video, audio and example requests while synthesis uses only the selected entry", async () => {
  const { qwenDefaults } = await import("./narration-model-settings.js");
  const { audioGenerateSchema } = await import("./audio-project-schema.js");
  const { sampleRequestSchema } = await import("./voice-samples.js");
  const parameters = {
    ...narrationPresets.natural,
    modelSettings: {
      "qwen3-base-0.6b": { ...qwenDefaults, temperature: 0.6, top_p: 0.8 },
      "qwen3-base-1.7b": { ...qwenDefaults, temperature: 1.2 },
      "future-model": { options: { strength: 5 }, modes: ["a", "b"] },
    },
  };
  assert.deepEqual(
    renderSchema.shape.voiceParameters.parse(parameters),
    parameters,
  );
  assert.deepEqual(
    audioGenerateSchema.parse({
      voiceModel: "qwen3-base-0.6b",
      voiceParameters: parameters,
    }).voiceParameters,
    parameters,
  );
  assert.deepEqual(
    sampleRequestSchema.parse({
      voice: "pt-1",
      text: "Peace",
      voiceModel: "qwen3-base-1.7b",
      voiceParameters: parameters,
    }).voiceParameters,
    parameters,
  );
  const args = narrationParameterArgs(parameters, "qwen3-base-0.6b");
  assert.equal(args[args.indexOf("--temperature") + 1], "0.6");
  assert.equal(args[args.indexOf("--top-p") + 1], "0.8");
  assert.equal(args.includes("--exaggeration"), false);
  assert.equal(args.includes("--future-model"), false);
});

test("CosyVoice presets select only their own controls and reject invalid modes or instructions", async () => {
  const { cosyDefaults } = await import("./narration-model-settings.js");
  const { effectiveNarrationParameters } =
    await import("./narration-parameters.js");
  const base = "cosyvoice3-base-0.5b",
    rl = "cosyvoice3-rl-0.5b";
  const bundle = {
    ...narrationPresets.expressive,
    modelSettings: {
      [base]: { ...cosyDefaults, top_k: 33 },
      [rl]: {
        ...cosyDefaults,
        mode: "instruct",
        instructions: "Speak calmly.",
        speed: 0.9,
      },
    },
  };
  assert.ok(narrationParametersSchema.safeParse(bundle).success);
  assert.deepEqual(effectiveNarrationParameters(bundle, base), {
    ...cosyDefaults,
    top_k: 33,
  });
  assert.deepEqual(
    effectiveNarrationParameters(bundle, rl),
    bundle.modelSettings[rl],
  );
  assert.deepEqual(
    effectiveNarrationParameters(narrationPresets.natural, base),
    cosyDefaults,
  );
  const args = narrationParameterArgs(bundle, rl);
  assert.equal(args[args.indexOf("--instructions") + 1], "Speak calmly.");
  assert.ok(
    !args.includes("--exaggeration") && !args.includes("--temperature"),
  );
  for (const invalid of [
    { ...cosyDefaults, mode: "instruct" },
    { ...cosyDefaults, mode: "instruct", instructions: "<|bad|>" },
    { ...cosyDefaults, speed: 0 },
    { ...cosyDefaults, tau_r: 2 },
  ]) {
    assert.equal(
      narrationParametersSchema.safeParse({
        ...narrationPresets.natural,
        modelSettings: { [base]: invalid },
      }).success,
      false,
    );
  }
});
