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
      "1.2",
    ]);
  }
  assert.deepEqual(narrationParameterArgs(), []);
  for (const [field, values] of Object.entries({
    exaggeration: [-0.01, 2.01],
    cfg_weight: [-0.01, 1.01],
    temperature: [0, 5.01],
    min_p: [0.1],
    top_p: [0.9],
    repetition_penalty: [2],
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
