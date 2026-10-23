import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adaptNarrationText,
  cleanNarrationText,
} from "./narration-text-adaptations.js";
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

test("speech cleanup removes only explicit editorial markers and preserves sentence punctuation", () => {
  const original =
    "¶ ‹Blessed› are ‹the poor in spirit: for theirs is the kingdom of heaven.›";
  const spoken =
    "Blessed are the poor in spirit: for theirs is the kingdom of heaven.";
  for (const locale of ["en", "es", "pt"]) {
    assert.equal(adaptNarrationText(original, locale), spoken);
    assert.equal(
      adaptNarrationText(original, locale, { reinforceSpanishRs: false }),
      spoken,
    );
  }
  assert.equal(cleanNarrationText("one¶two ¶ ¶ three"), "one two three");
  assert.equal(
    cleanNarrationText("‹Blessed.›\n¶ ‹Rejoice: always!›"),
    "Blessed.\nRejoice: always!",
  );
  assert.equal(cleanNarrationText(spoken), spoken);
  assert.equal(cleanNarrationText("¶ ‹›"), "");
});

test("speech cleanup preserves valuable punctuation, Unicode, spacing and unrecognized symbols", () => {
  const valuable = `“Don't”—it's John's word; 3:16, 3.14… (yes!) [amen?] «Olá: ação e bênção.» ¿Quién? ¡Él! rock-solid −2 + 3 = 1 / 2 † ‡ § *`;
  assert.equal(cleanNarrationText(valuable), valuable);
  assert.equal(cleanNarrationText(`¶ ‹${valuable}›`), valuable);
  assert.equal(
    cleanNarrationText("  Keep\tspacing.\nNext line: yes.  "),
    "  Keep\tspacing.\nNext line: yes.  ",
  );
  const decomposed = "bênção";
  assert.equal(cleanNarrationText(`‹${decomposed}›`), decomposed);
  assert.equal(
    adaptNarrationText("¶ ‹Rosa› corre rápido.", "es", {
      reinforceSpanishRs: true,
    }),
    "Rrosa corrre rrápido.",
  );
  const cleaned = cleanNarrationText("¶ ‹Blessed› are the poor: amen.");
  assert.equal(cleanNarrationText(cleaned), cleaned);
});
