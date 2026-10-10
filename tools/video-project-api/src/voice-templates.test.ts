import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as short from "./engines/short/voice";
import * as long from "./engines/long/voice";
const context = {
  locale: "es" as const,
  reference: "Juan capítulo tres versículos dieciséis al diecisiete",
  version: "Reina Valera",
  book: "Juan",
  start: "3:16",
  end: "3:17",
  passage_id: "john-3-16-17",
  templates: {
    intro: "Escucha {reference} en {version}.",
    outro: "{book}: {start} al {end}.",
  },
};
test("both narration engines expand supplied templates without local template files", async () => {
  for (const engine of [short, long]) {
    const scripts = await engine.renderVoiceScripts(context);
    assert.equal(
      scripts.intro,
      `Escucha ${context.reference} en Reina Valera.`,
    );
    assert.equal(scripts.outro, "Juan: 3:16 al 3:17.");
    assert.deepEqual(
      await engine.renderVoiceScripts({
        ...context,
        templates: { intro: "", outro: "" },
      }),
      { intro: "", outro: "" },
    );
    await assert.rejects(
      engine.renderVoiceScripts({
        ...context,
        templates: { intro: "{unsupported}", outro: "" },
      }),
      /Unsupported voice template/,
    );
  }
});
test("an unconfigured narration is rejected before invoking synthesis", async () => {
  const folder = await fs.mkdtemp(
    path.join(os.tmpdir(), "veobible-voice-template-test-"),
  );
  try {
    for (const engine of [short, long]) {
      await assert.rejects(
        engine.generateVoice(
          folder,
          { ...context, templates: { intro: "", outro: "" } },
          true,
          "intro",
        ),
        /Missing voice template/,
      );
    }
    assert.deepEqual(await fs.readdir(folder), []);
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});

test("custom narration is used literally in both formats without changing the other script", async () => {
  for (const engine of [short, long]) {
    const scripts = await engine.renderVoiceScripts({
      ...context,
      scriptOverrides: {
        intro: "  Texto manual con {reference}, sin sustitución.  ",
      },
    });
    assert.equal(
      scripts.intro,
      "Texto manual con {reference}, sin sustitución.",
    );
    assert.equal(scripts.outro, "Juan: 3:16 al 3:17.");
    assert.equal(
      (
        await engine.renderVoiceScripts({
          ...context,
          templates: { intro: "", outro: "" },
          scriptOverrides: { outro: "Cierre manual." },
        })
      ).outro,
      "Cierre manual.",
    );
  }
});
