import { test } from "node:test";
import assert from "node:assert/strict";
import { audioGenerateSchema } from "./audio-project-schema.js";

test("temporary pronunciation text is limited to synthesis of one verse", () => {
  assert.equal(
    audioGenerateSchema.parse({
      chapter: 1,
      verse: 2,
      regenerate: true,
      textOverride: "  Adapted pronunciation.  ",
    }).textOverride,
    "Adapted pronunciation.",
  );
  for (const request of [
    { chapter: 1, textOverride: "One verse only." },
    { chapter: 1, verse: 2, textOverride: "   " },
    { chapter: 1, verse: 2, textOverride: "x".repeat(5001) },
    {
      chapter: 1,
      verse: 2,
      alignOnly: true,
      textOverride: "Not for analysis.",
    },
    { chapter: 1, assembleOnly: true, textOverride: "Not for final audio." },
  ])
    assert.equal(audioGenerateSchema.safeParse(request).success, false);
});
