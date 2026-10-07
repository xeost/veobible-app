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
    /audio cut/,
  );
  assert.match(
    userMessage("Missing voice audio stream: /private/intro.wav"),
    /Files needed/,
  );
  assert.match(
    userMessage("Configura PROXY_API_TOKEN", 503),
    /Could not connect/,
  );

  // Localization with language parameter
  assert.match(
    userMessage(
      "Audio offsets produce an invalid audio cut for chapter.mp3",
      undefined,
      "es",
    ),
    /corte de audio/,
  );
  assert.match(
    userMessage(
      "Missing voice audio stream: /private/intro.wav",
      undefined,
      "es",
    ),
    /Faltan archivos/,
  );
  assert.match(
    userMessage("Configura PROXY_API_TOKEN", 503, "es"),
    /No se pudo conectar/,
  );
  assert.match(
    userMessage(
      "Missing voice audio stream: /private/intro.wav",
      undefined,
      "pt",
    ),
    /Faltam arquivos/,
  );
});

test("generation history uses readable stages and states", () => {
  // English defaults
  assert.equal(statusLabel("done"), "Completed");
  assert.equal(statusLabel("unknown"), "Awaiting confirmation");
  assert.equal(
    generationStage("Renderizando con Remotion", "running"),
    "Creating the video",
  );
  assert.equal(
    generationStage("Generando voces con IA local", "running"),
    "Preparing the narration",
  );
  assert.equal(generationStage("Complete", "done"), "Video generated");

  // Spanish
  assert.equal(statusLabel("done", "es"), "Completado");
  assert.equal(statusLabel("unknown", "es"), "Por confirmar");
  assert.equal(
    generationStage("Renderizando con Remotion", "running", "es"),
    "Creando el video",
  );
  assert.equal(
    generationStage("Generando voces con IA local", "running", "es"),
    "Preparando la narración",
  );
  assert.equal(generationStage("Complete", "done", "es"), "Video generado");

  // Portuguese
  assert.equal(statusLabel("done", "pt"), "Concluído");
  assert.equal(statusLabel("unknown", "pt"), "A confirmar");
  assert.equal(
    generationStage("Renderizando con Remotion", "running", "pt"),
    "Criando o vídeo",
  );
  assert.equal(
    generationStage("Generando voces con IA local", "running", "pt"),
    "Preparando a narração",
  );
  assert.equal(generationStage("Complete", "done", "pt"), "Vídeo gerado");
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
    voices: "Generated narration",
    duration: 71.04,
  });

  const summaryEs = jobSummary(
    {
      snapshot: JSON.stringify({
        id: "internal-id",
        callback: { token: "secret" },
        version: { label: "Reina Valera 1909" },
        settings: { volumeMultiplier: 1.2, clipAudioMode: "voice" },
      }),
      result: JSON.stringify({ output: "/private/render", duration: 71.04 }),
    },
    "es",
  );
  assert.equal(summaryEs.voices, "Narración generada");

  const summaryPt = jobSummary(
    {
      snapshot: JSON.stringify({
        id: "internal-id",
        callback: { token: "secret" },
        version: { label: "Reina Valera 1909" },
        settings: { volumeMultiplier: 1.2, clipAudioMode: "voice" },
      }),
      result: JSON.stringify({ output: "/private/render", duration: 71.04 }),
    },
    "pt",
  );
  assert.equal(summaryPt.voices, "Narração gerada");

  assert.equal(jobSummary({ snapshot: "invalid" }).version, null);
});
