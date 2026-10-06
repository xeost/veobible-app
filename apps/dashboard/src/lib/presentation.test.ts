import { test } from "node:test";
import assert from "node:assert/strict";
import {
  userMessage,
  statusLabel,
  generationStage,
  jobSummary,
} from "./presentation";
test("technical errors are replaced by actionable, stable user messages", () => {
  const raw = new Error(
    "D1_ERROR: SQL constraint failed in /private/project/db.sqlite",
  );
  const message = userMessage(raw);
  assert.doesNotMatch(message, /D1|SQL|sqlite|private|Error:/);
  assert.equal(userMessage(new Error(message)), message);
  assert.match(
    userMessage("Audio offsets produce an invalid audio cut for chapter.mp3"),
    /corte de audio/,
  );
  assert.match(
    userMessage("Missing voice audio stream: /private/intro.wav"),
    /Faltan archivos/,
  );
  assert.match(
    userMessage("Configura VIDEO_API_TOKEN", 503),
    /No se pudo conectar/,
  );
});
test("generation history uses readable stages and states", () => {
  assert.equal(statusLabel("done"), "Completado");
  assert.equal(statusLabel("unknown"), "Por confirmar");
  assert.equal(
    generationStage("Renderizando con Remotion", "running"),
    "Creando el video",
  );
  assert.equal(
    generationStage("Generando voces con IA local", "running"),
    "Preparando la narración",
  );
  assert.equal(generationStage("Complete", "done"), "Video generado");
});
test("history exposes editing choices instead of raw job data", () => {
  const summary = jobSummary({
    snapshot: JSON.stringify({
      id: "internal-id",
      callback: { token: "secret" },
      version: { label: "Reina Valera 1909" },
      settings: { volumeMultiplier: 1.2, clipAudioMode: "voice" },
    }),
    result: JSON.stringify({ output: "/private/render", duration: 71.04 }),
  });
  assert.deepEqual(summary, {
    version: "Reina Valera 1909",
    volume: 1.2,
    voices: "Narración generada",
    duration: 71.04,
  });
  assert.equal(jobSummary({ snapshot: "invalid" }).version, null);
});
