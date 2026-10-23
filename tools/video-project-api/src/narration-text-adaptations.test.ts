import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptNarrationText } from "./narration-text-adaptations.js";
import {
  narrationModelsSchema,
  defaultNarrationModels,
  selectedNarrationTextAdaptations,
} from "./narration-models.js";

test("Spanish R reinforcement applies each replacement once and respects Unicode word starts", () => {
  const enabled = { reinforceSpanishRs: true };
  assert.equal(
    adaptNarrationText(
      "Rosa corre rápido. El perro de Raúl corre al río.",
      "es",
      enabled,
    ),
    "Rrosa corrre rrápido. El perrro de Rraúl corrre al rrío.",
  );
  assert.equal(adaptNarrationText("rr r R", "es", enabled), "rrr rr Rr");
  assert.equal(
    adaptNarrationText(
      "honra Israel alrededor árosa érica _r 1r —rojo 'Rosa'",
      "es",
      enabled,
    ),
    "honra Israel alrededor árosa érica _r 1r —rrojo 'Rrosa'",
  );
  for (const locale of ["en", "pt"])
    assert.equal(
      adaptNarrationText("Rosa corre rápido.", locale, enabled),
      "Rosa corre rápido.",
    );
  assert.equal(
    adaptNarrationText("Rosa corre rápido.", "es"),
    "Rosa corre rápido.",
  );
  assert.equal(
    adaptNarrationText("Rosa corre rápido.", "es", {
      reinforceSpanishRs: false,
    }),
    "Rosa corre rápido.",
  );
});

test("adaptations follow the selected Spanish model without affecting other models or languages", () => {
  const models = narrationModelsSchema.parse({
    ...defaultNarrationModels(),
    textAdaptations: {
      es: {
        latam: { reinforceSpanishRs: true },
        "multilingual-v3": { reinforceSpanishRs: false },
      },
    },
  });
  assert.equal(selectedNarrationTextAdaptations(models, "es"), undefined);
  models.es = "latam";
  assert.deepEqual(selectedNarrationTextAdaptations(models, "es"), {
    reinforceSpanishRs: true,
  });
  assert.equal(selectedNarrationTextAdaptations(models, "en"), undefined);
  assert.equal(selectedNarrationTextAdaptations(models, "pt"), undefined);
  assert.equal(
    narrationModelsSchema.safeParse({ ...models, textAdaptations: { en: {} } })
      .success,
    false,
  );
});
