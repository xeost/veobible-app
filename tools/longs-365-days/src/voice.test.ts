import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { generateVoice, numberToWords, renderVoiceScripts, resolveVoicePrompts, spokenReference, voiceContext } from "./voice.js";
import { config } from "./config.js";
import { installPreparedOutput, orderPassagesByUsage, regenerateVoiceTrack, reusableVoiceParts, hasRenderedEpisode, type Passage, type Status } from "./episodes.js";

const passage: Passage = { id: "john-3-14-19", book: "john", start: { chapter: 3, verse: 14 }, end: { chapter: 3, verse: 19 } };

test("used passages move to the end without changing editorial order", () => {
  const catalog = ["a", "b", "c", "d"].map(id => ({ ...passage, id }));
  const used = { usedAt: "2026-01-01T00:00:00Z", locale: "es", version: "rv1909", output: "/tmp" };
  const status: Status = { "es/rv1909/b": used, "es/rv1909/d": used };
  assert.deepEqual(orderPassagesByUsage(catalog, status, { locale: "es", id: "rv1909" }).map(item => item.id), ["a", "c", "b", "d"]);
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
    await fs.writeFile(fakePython, '#!/bin/sh\nwhile [ "$1" != "--scripts" ]; do shift; done\nscripts="$2"\nwhile [ "$1" != "--output-dir" ]; do shift; done\ncp "$scripts" "$2/requested.json"\n', { mode: 0o755 });
    Object.assign(config.ttsTrackVoicePrompts.es, { outro: path.join(output, "missing-outro.mp3") });
    await generateVoice(output, voiceContext(version, passage, "Juan", "Reina Valera"), false, "intro");
    const requested = JSON.parse(await fs.readFile(path.join(output, "requested.json"), "utf8"));
    assert.deepEqual(Object.keys(requested), ["intro"], "Chatterbox receives only the requested track");
    Object.assign(config.ttsTrackVoicePrompts.es, { outro: "" });
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

test("regenerating one track preserves the other track, video and settings, including API failures", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-single-voice-"));
  const originalFetch = globalThis.fetch;
  const original = { ttsProvider: config.ttsProvider, elevenLabsApiKey: config.elevenLabsApiKey, outputDir: config.outputDir, bibleDataDir: config.bibleDataDir };
  const originalVoice = config.elevenLabsVoices.es;
  const version = config.versions.find(value => value.locale === "es")!;
  const output = path.join(root, "outputs", version.id, passage.id);
  const internal = path.join(output, "_internal");
  const untouched = { "3-outro.wav": "previous outro audio", "3-outro.txt": "previous outro script", "2-passage-audio-settings.json": '{"volumeMultiplier":2}', "2-passage-audio-offsets.json": '{"startSeconds":0.5,"endSeconds":0}' };
  try {
    Object.assign(config, { ttsProvider: "elevenlabs", elevenLabsApiKey: "test-key", outputDir: path.join(root, "outputs"), bibleDataDir: path.join(root, "bible") });
    Object.assign(config.elevenLabsVoices, { es: "test-voice" });
    const indexDir = path.join(config.bibleDataDir, version.locale, version.id);
    await fs.mkdir(indexDir, { recursive: true });
    await fs.writeFile(path.join(indexDir, "index.json"), JSON.stringify({ metadata: { name: "Test Bible" }, books: [{ id: "john", name: "Juan", chapters: 3, versesPerChapter: [51, 25, 36] }] }));
    await fs.mkdir(internal, { recursive: true });
    for (const [name, text] of Object.entries(untouched)) await fs.writeFile(path.join(internal, name), text);
    await fs.writeFile(path.join(internal, "1-intro.wav"), "old intro");
    await fs.writeFile(path.join(internal, "1-intro.txt"), "old script");
    await fs.writeFile(path.join(output, "episode.mp4"), "previous video");
    const sample = path.join(root, "sample.mp3");
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1", "-y", sample]);
    const audio = await fs.readFile(sample);
    const requests: string[] = [];
    let rejectRequest = false;
    globalThis.fetch = async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)).text);
      return rejectRequest ? new Response("test failure", { status: 402 }) : new Response(audio, { status: 200 });
    };
    const introFile = await regenerateVoiceTrack(version, passage, "intro");
    const introAudio = await fs.readFile(introFile);
    assert.ok(introAudio.length > 100);
    assert.equal(requests.length, 1);
    assert.match(requests[0], /Bienvenidos a La Biblia/);
    for (const [name, text] of Object.entries(untouched)) assert.equal(await fs.readFile(path.join(internal, name), "utf8"), text);
    assert.equal(await fs.readFile(path.join(output, "episode.mp4"), "utf8"), "previous video");
    rejectRequest = true;
    await assert.rejects(regenerateVoiceTrack(version, passage, "outro"), /HTTP 402/);
    assert.equal(await fs.readFile(path.join(internal, "3-outro.wav"), "utf8"), untouched["3-outro.wav"]);
    assert.equal(await fs.readFile(path.join(internal, "3-outro.txt"), "utf8"), untouched["3-outro.txt"]);
    rejectRequest = false;
    await regenerateVoiceTrack(version, passage, "outro");
    assert.equal(requests.length, 3);
    assert.match(requests[2], /Acabas de escuchar/);
    assert.deepEqual(await fs.readFile(introFile), introAudio);
    assert.equal((await fs.readdir(internal)).some(name => name.startsWith(".regenerate-")), false);
    const fresh = { ...passage, id: "episode-before-render" };
    const freshOutput = path.join(config.outputDir, version.id, fresh.id);
    await assert.rejects(fs.access(freshOutput), { code: "ENOENT" });
    const freshIntro = await regenerateVoiceTrack(version, fresh, "intro");
    const savedIntro = await fs.readFile(freshIntro);
    assert.deepEqual(await reusableVoiceParts(freshOutput), ["intro"]);
    assert.equal(await hasRenderedEpisode(freshOutput), false, "Creating audio does not imply that the video has been rendered");
    await regenerateVoiceTrack(version, fresh, "outro");
    assert.deepEqual(await reusableVoiceParts(freshOutput), ["intro", "outro"]);
    assert.deepEqual(await fs.readFile(freshIntro), savedIntro);
    assert.equal(await hasRenderedEpisode(freshOutput), false);
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(config, original);
    Object.assign(config.elevenLabsVoices, { es: originalVoice });
    await fs.rm(root, { recursive: true, force: true });
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
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1", "-y", mp3]);
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
