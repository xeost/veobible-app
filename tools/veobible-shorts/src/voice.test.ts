import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { generateVoice, numberToWords, renderVoiceScripts, resolveVoicePrompts, spokenReference, voiceContext } from "./voice.js";
import { config } from "./config.js";
import { installPreparedOutput, orderPassagesByUsage, type Passage, type Status } from "./shorts.js";

const passage: Passage = { id: "john-3-14-19", book: "john", start: { chapter: 3, verse: 14 }, end: { chapter: 3, verse: 19 } };

test("used passages move to the end without changing editorial order", () => {
  const catalog = ["a", "b", "c", "d"].map(id => ({ ...passage, id }));
  const used = { usedAt: "2026-01-01T00:00:00Z", locale: "es", version: "rv1909", output: "/tmp" };
  const status: Status = { b: used, d: used };
  assert.deepEqual(orderPassagesByUsage(catalog, status).map(item => item.id), ["a", "c", "b", "d"]);
  assert.deepEqual(catalog.map(item => item.id), ["a", "b", "c", "d"]);
});

test("reprocessing replaces the complete output and restores it if installation fails", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-reprocess-test-"));
  const destination = path.join(root, "passage");
  const staging = path.join(root, "staging");
  try {
    await fs.mkdir(destination);
    await fs.mkdir(staging);
    await fs.writeFile(path.join(destination, "old.txt"), "previous output");
    await fs.writeFile(path.join(staging, "new.txt"), "new output");
    await installPreparedOutput(staging, destination, true);
    assert.equal(await fs.readFile(path.join(destination, "new.txt"), "utf8"), "new output");
    await assert.rejects(fs.access(path.join(destination, "old.txt")));
    await assert.rejects(installPreparedOutput(staging, destination, true));
    assert.equal(await fs.readFile(path.join(destination, "new.txt"), "utf8"), "new output");
    assert.deepEqual(await fs.readdir(root), ["passage"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("las referencias del pasaje se escriben con palabras en los tres idiomas", async () => {
  const examples = [
    { locale: "es", book: "Juan", reference: "Juan capítulo tres versículos catorce al diecinueve" },
    { locale: "en", book: "John", reference: "John chapter three verses fourteen to nineteen" },
    { locale: "pt", book: "João", reference: "João capítulo três versículos catorze a dezenove" }
  ] as const;
  for (const example of examples) {
    const version = config.versions.find(value => value.locale === example.locale)!;
    const context = voiceContext(version, passage, example.book, "Versión de prueba");
    assert.equal(context.reference, example.reference);
    const scripts = await renderVoiceScripts(context);
    assert.ok(scripts.intro.includes(example.reference));
    assert.ok(scripts.outro.includes(example.reference));
    assert.doesNotMatch(scripts.intro + scripts.outro, /\d/);
  }
});

test("los números compuestos y las centenas se pronuncian correctamente", () => {
  assert.equal(numberToWords("es", 21), "veintiuno");
  assert.equal(numberToWords("es", 100), "cien");
  assert.equal(numberToWords("es", 119), "ciento diecinueve");
  assert.equal(numberToWords("en", 21), "twenty-one");
  assert.equal(numberToWords("en", 119), "one hundred and nineteen");
  assert.equal(numberToWords("pt", 21), "vinte e um");
  assert.equal(numberToWords("pt", 100), "cem");
  assert.equal(numberToWords("pt", 119), "cento e dezenove");
});

test("los libros numerados, versículos únicos y pasajes entre capítulos no conservan cifras", () => {
  const single: Passage = { ...passage, start: { chapter: 1, verse: 21 }, end: { chapter: 1, verse: 21 } };
  const cross: Passage = { ...passage, start: { chapter: 3, verse: 36 }, end: { chapter: 4, verse: 2 } };
  assert.equal(spokenReference("es", "1 Juan", single), "Primera de Juan capítulo uno versículo veintiuno");
  assert.equal(spokenReference("en", "2 John", single), "Second John chapter one verse twenty-one");
  assert.equal(spokenReference("pt", "3 João", single), "Terceira de João capítulo um versículo vinte e um");
  assert.equal(spokenReference("es", "Juan", cross), "Juan, desde el capítulo tres versículo treinta y seis hasta el capítulo cuatro versículo dos");
  assert.doesNotMatch(spokenReference("en", "John", cross), /\d/);
  assert.doesNotMatch(spokenReference("pt", "João", cross), /\d/);
});

test("Chatterbox prefiere muestras de intro y outro y recurre a la voz del idioma", async () => {
  const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-voice-prompts-test-"));
  const voicesDir = path.join(workingDir, "material", "voices");
  const originalWorkingDir = config.workingDir;
  const originalFallbacks = { ...config.ttsVoicePrompts };
  const originalTracks = structuredClone(config.ttsTrackVoicePrompts);
  try {
    await fs.mkdir(voicesDir, { recursive: true });
    Object.assign(config, { workingDir });
    for (const locale of ["es", "en", "pt"] as const) {
      const fallback = path.join(voicesDir, `${locale}.mp3`);
      const intro = path.join(voicesDir, `${locale}-intro.wav`);
      const outro = path.join(voicesDir, `${locale}-outro.mp3`);
      Object.assign(config.ttsVoicePrompts, { [locale]: fallback });
      Object.assign(config.ttsTrackVoicePrompts[locale], { intro: undefined, outro: undefined });
      await Promise.all([fallback, intro, outro].map(filename => fs.writeFile(filename, "sample")));
      assert.deepEqual(await resolveVoicePrompts(locale), { intro, outro });
      await fs.rm(fallback);
      assert.deepEqual(await resolveVoicePrompts(locale), { intro, outro });
      await fs.writeFile(fallback, "sample");
      await fs.rm(outro);
      assert.deepEqual(await resolveVoicePrompts(locale), { intro, outro: fallback });
      await fs.rm(fallback);
      const wavFallback = path.join(voicesDir, `${locale}.wav`);
      await fs.writeFile(wavFallback, "sample");
      assert.deepEqual(await resolveVoicePrompts(locale), { intro, outro: wavFallback });
    }
    const custom = path.join(voicesDir, "custom-intro.mp3");
    await fs.writeFile(custom, "sample");
    Object.assign(config.ttsTrackVoicePrompts.es, { intro: custom, outro: "" });
    assert.deepEqual(await resolveVoicePrompts("es"), { intro: custom, outro: null });
  } finally {
    Object.assign(config, { workingDir: originalWorkingDir });
    Object.assign(config.ttsVoicePrompts, originalFallbacks);
    for (const locale of ["es", "en", "pt"] as const) Object.assign(config.ttsTrackVoicePrompts[locale], originalTracks[locale]);
    await fs.rm(workingDir, { recursive: true, force: true });
  }
});

test("la salida de Chatterbox muestra etapas y oculta los mensajes técnicos", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-quiet-voice-test-"));
  const fakePython = path.join(output, "fake-python");
  const original = {
    provider: config.ttsProvider,
    python: config.ttsPython,
    prompt: config.ttsVoicePrompts.es,
    tracks: { ...config.ttsTrackVoicePrompts.es }
  };
  const originalLog = console.log;
  const messages: string[] = [];
  try {
    await fs.writeFile(fakePython, "#!/bin/sh\nprintf 'Stage: Loading model\\nStage: Generating intro\\nStage: Generating outro\\n'\nprintf 'Fetching 6 files: 100%%\\nFutureWarning: noise\\n' >&2\n", { mode: 0o755 });
    Object.assign(config, { ttsProvider: "chatterbox", ttsPython: fakePython });
    Object.assign(config.ttsVoicePrompts, { es: "" });
    Object.assign(config.ttsTrackVoicePrompts.es, { intro: "", outro: "" });
    console.log = (...values: unknown[]) => { messages.push(values.join(" ")); };
    const version = config.versions.find(value => value.locale === "es")!;
    await generateVoice(output, voiceContext(version, passage, "Juan", "Reina Valera"));
    assert.ok(messages.some(message => message.includes("Generating intro")));
    assert.ok(messages.some(message => message.includes("Generating outro")));
    assert.doesNotMatch(messages.join("\n"), /Fetching|FutureWarning|Esta es tu dosis/);
    await fs.writeFile(fakePython, "#!/bin/sh\nprintf 'Stage: Loading model\\n'\nprintf 'Error: broken model\\n' >&2\nexit 1\n", { mode: 0o755 });
    await assert.rejects(generateVoice(output, voiceContext(version, passage, "Juan", "Reina Valera")), /broken model/);
  } finally {
    console.log = originalLog;
    Object.assign(config, { ttsProvider: original.provider, ttsPython: original.python });
    Object.assign(config.ttsVoicePrompts, { es: original.prompt });
    Object.assign(config.ttsTrackVoicePrompts.es, original.tracks);
    await fs.rm(output, { recursive: true, force: true });
  }
});

test("ElevenLabs usa la voz del idioma y genera WAV y guiones sin usar Chatterbox", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-elevenlabs-test-"));
  const originalFetch = globalThis.fetch;
  const original = {
    provider: config.ttsProvider,
    key: config.elevenLabsApiKey,
    voice: config.elevenLabsVoices.es
  };
  try {
    const mp3 = path.join(output, "sample.mp3");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1", "-y", mp3]);
    const audio = await fs.readFile(mp3);
    Object.assign(config, { ttsProvider: "elevenlabs", elevenLabsApiKey: "test-key" });
    Object.assign(config.elevenLabsVoices, { es: "spanish-voice" });
    const requests: Array<{ url: string; text: string }> = [];
    globalThis.fetch = async (input, init) => {
      assert.match(String(input), /\/spanish-voice\?output_format=mp3_44100_128$/);
      assert.equal((init?.headers as Record<string, string>)["xi-api-key"], "test-key");
      requests.push({ url: String(input), text: JSON.parse(String(init?.body)).text });
      return new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    };
    const version = config.versions.find(value => value.locale === "es")!;
    await generateVoice(output, voiceContext(version, passage, "Juan", "Reina Valera"));
    assert.equal(requests.length, 2);
    for (const part of ["intro", "outro"]) {
      for (const extension of ["txt", "wav"]) assert.ok((await fs.stat(path.join(output, `${part}.${extension}`))).size > 0);
      await assert.rejects(fs.access(path.join(output, `${part}.aiff`)));
    }
    await assert.rejects(generateVoice(output, voiceContext(version, passage, "Juan", "Reina Valera")), /Audio or text files already exist/);
    assert.equal(requests.length, 2);
    await Promise.all(["intro", "outro"].map(part => fs.writeFile(path.join(output, `${part}.aiff`), "old format")));
    await generateVoice(output, voiceContext(version, passage, "Juan", "Reina Valera"), true);
    assert.equal(requests.length, 4);
    for (const part of ["intro", "outro"]) await assert.rejects(fs.access(path.join(output, `${part}.aiff`)));
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(config, { ttsProvider: original.provider, elevenLabsApiKey: original.key });
    Object.assign(config.elevenLabsVoices, { es: original.voice });
    await fs.rm(output, { recursive: true, force: true });
  }
});
