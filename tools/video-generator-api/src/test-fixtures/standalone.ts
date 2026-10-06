import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const execute = promisify(execFile);
const working = process.cwd();
const data = path.join(working, "resources/bible-data/es/rv1909");
const audio = path.join(working, "material/bible-audio/rv1909");
await fs.mkdir(audio, { recursive: true });
await fs.mkdir(data, { recursive: true });
await fs.writeFile(
  path.join(data, "index.json"),
  JSON.stringify({
    metadata: { name: "Test version" },
    books: [
      { id: "genesis", name: "Génesis", chapters: 1, versesPerChapter: [1] },
      { id: "exodus", name: "Éxodo", chapters: 1, versesPerChapter: [1] },
    ],
  }),
);
for (const [index, book] of ["genesis", "exodus"].entries()) {
  await fs.mkdir(path.join(data, book));
  await fs.writeFile(
    path.join(data, book, "1.json"),
    JSON.stringify([{ verse: 1, text: "Texto bíblico de prueba." }]),
  );
  await execute("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=0.5",
    "-y",
    path.join(audio, `${String(index + 1).padStart(2, "0")}-${book}-1.mp3`),
  ]);
}
const provider = path.join(working, "voice-fixture.mjs");
await fs.writeFile(
  provider,
  `import fs from 'node:fs/promises'; import path from 'node:path'; import {execFileSync} from 'node:child_process';
const arg = key => process.argv[process.argv.indexOf(key)+1];
const scripts=JSON.parse(await fs.readFile(arg('--scripts'),'utf8'));
for(const [part,text] of Object.entries(scripts)){execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=880:duration=0.25','-y',path.join(arg('--output-dir'),part+'.wav')]);await fs.writeFile(path.join(arg('--output-dir'),part+'.txt'),text);}`,
);
process.env.VIDEO_TTS_SCRIPT = provider;
for (const kind of ["SHORT", "LONG"]) {
  process.env[`VIDEO_${kind}_TTS_PYTHON`] = process.execPath;
  process.env[`VIDEO_${kind}_RENDER_CONCURRENCY`] = "2";
  process.env[`VIDEO_${kind}_TTS_VOICE_PROMPT_ES`] = "";
}
// Modules load only after this standalone environment is configured.
const {
  analyze,
  inspection,
  render,
  sourceDir,
  projectDir,
  generateProjectVoice,
} = await import("../pipeline.js");
const { renderSchema } = await import("../protocol.js");
for (const kind of ["short", "long"] as const) {
  const clips = path.join(working, "material", kind, "videos");
  await fs.mkdir(clips, { recursive: true });
  if (process.env.VIDEO_SMOKE_RENDER === "1") {
    for (const name of ["0-intro.mp4", "0-outro.mp4", "bg-1.mp4"]) {
      await execute("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        `color=c=navy:s=${kind === "short" ? "270x480" : "480x270"}:r=12:d=0.5`,
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=220:duration=0.5",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        "-y",
        path.join(clips, name),
      ]);
    }
  } else {
    await fs.writeFile(
      path.join(clips, "bg-1.mp4"),
      "not rendered in analysis test",
    );
  }
  const input = renderSchema.parse({
    id: randomUUID(),
    projectId: randomUUID(),
    kind,
    version: { id: "rv1909", locale: "es", label: "Test version" },
    passage: {
      id: "standalone",
      book: "genesis",
      ...(kind === "long" ? { endBook: "exodus", episode: 1 } : {}),
      start: { chapter: 1, verse: 1 },
      end: { chapter: 1, verse: 1 },
    },
    settings: { background: "bg-1.mp4" },
    callback: { url: "http://127.0.0.1:3003/callback", token: "x".repeat(32) },
  });
  const preview = await inspection(input);
  assert.equal(preview.sections.length, kind === "short" ? 1 : 2);
  assert.equal(preview.cues.length, kind === "short" ? 1 : 2);
  assert.ok(preview.text.every((row) => row.inPassage || kind === "short"));
  assert.ok(preview.scripts.intro.length > 0);
  // Either narration must be able to create a completely new project on its own.
  for (const part of ["intro", "outro"] as const) {
    const fresh = { ...input, projectId: randomUUID() };
    const sources = sourceDir(kind, fresh.projectId);
    const output = projectDir(kind, fresh.projectId);
    await assert.rejects(fs.stat(sources), { code: "ENOENT" });
    await assert.rejects(fs.stat(output), { code: "ENOENT" });
    await generateProjectVoice(fresh, part);
    assert.ok((await fs.stat(output)).isDirectory());
    assert.deepEqual(await fs.readdir(sources), [`${part}.wav`]);
    assert.ok((await fs.stat(path.join(sources, `${part}.wav`))).size > 44);
    await generateProjectVoice(fresh, part);
    assert.deepEqual(await fs.readdir(sources), [`${part}.wav`]);
  }
  const analyzed = await analyze(input);
  const voices = sourceDir(kind, input.projectId);
  await analyzed.m.voice.generateVoice(voices, analyzed.context, true);
  assert.ok((await fs.stat(path.join(voices, "intro.wav"))).size > 44);
  assert.ok(
    !(await fs.readdir(voices)).some((name) => name.startsWith(".voice-")),
  );
  // The pipeline removes adapter text files; only multimedia stays under project media.
  for (const name of ["intro.txt", "outro.txt"])
    await fs.rm(path.join(voices, name));
  const otherVoice = await fs.readFile(path.join(voices, "outro.wav"));
  await generateProjectVoice(input, "intro");
  assert.deepEqual(
    await fs.readFile(path.join(voices, "outro.wav")),
    otherVoice,
  );
  assert.ok((await fs.stat(path.join(voices, "intro.wav"))).size > 44);
  assert.ok(
    !(await fs.readdir(voices)).some(
      (name) => name.endsWith(".txt") || name.startsWith(".voice-"),
    ),
  );
  if (process.env.VIDEO_SMOKE_RENDER === "1") {
    const result = await render(input, () => {});
    assert.ok((await fs.stat(result.video)).size > 100);
    assert.ok((await fs.stat(result.thumbnail)).size > 100);
    assert.equal(result.verseCues.length, kind === "short" ? 1 : 2);
    assert.ok(result.sources.every((file) => file.startsWith(working)));
    assert.deepEqual((await fs.readdir(path.dirname(result.video))).sort(), [
      "thumbnail.jpg",
      "video.mp4",
    ]);
    assert.deepEqual((await fs.readdir(voices)).sort(), [
      "intro.wav",
      "outro.wav",
    ]);
  }
}
console.log("standalone pipeline passed: short, long");
if (process.env.VIDEO_SMOKE_RENDER === "1")
  console.log("standalone renders passed: short, long");
