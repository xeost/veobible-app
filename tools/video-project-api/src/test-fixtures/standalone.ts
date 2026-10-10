import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const execute = promisify(execFile);
const working = process.cwd();
process.env.SHORTS_WORKING_DIR = path.join(working, "work", "short");
process.env.LONGS_WORKING_DIR = path.join(working, "work", "long");
const data = path.resolve(
  working,
  "../../apps/frontend/public/bible-data/es/rv1909",
);
const audio = path.join(
  working,
  "work",
  "short",
  "material",
  "bible-audio",
  "rv1909",
);
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
process.env.VIDEO_AUDIO_DIR = path.dirname(audio);
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
  voiceFilename,
  projectChapterVoiceFiles,
  generateProjectVoice,
} = await import("../pipeline.js");
const { renderSchema } = await import("../protocol.js");
const { audioDurationSeconds } = await import("../engines/short/shorts.js");
for (const [kind, outputEnvironment] of [
  ["short", "production"],
  ["long", "production"],
  ["short", "development"],
  ["long", "development"],
] as const) {
  const clips = path.join(working, "work", kind, "material", "videos");
  await fs.mkdir(clips, { recursive: true });
  if (
    process.env.VIDEO_SMOKE_RENDER === "1" ||
    process.env.VIDEO_SMOKE_PREVIEW === "1"
  ) {
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
    projectId: Math.floor(Math.random() * 1000000) + 1,
    kind,
    outputEnvironment,
    version: { id: "rv1909", locale: "es", label: "Test version" },
    passage: {
      id: "standalone",
      book: "genesis",
      ...(kind === "long" ? { endBook: "exodus", episode: 1 } : {}),
      start: { chapter: 1, verse: 1 },
      end: { chapter: 1, verse: 1 },
    },
    settings: { background: "bg-1.mp4" },
    publicationTemplates: {
      youtube:
        "# Title\n{title}\n\n# Description\n{reference} — {version}\n{passage_url}\n{hashtags}",
      facebook: "{title}\n{reference} — {version}\n{hashtags}",
      ...(kind === "short" ? { instagram: "{title}\n{hashtags}" } : {}),
      tiktok: "{title}\n{hashtags}",
      x: "{title}\n{passage}\n{hashtags}",
    },
    voiceTemplates: {
      intro: "Introducción de prueba para {reference}.",
      outro: "Cierre de prueba para {reference}.",
    },
    callback: { url: "http://127.0.0.1:3003/callback", token: "x".repeat(32) },
  });
  const preview = await inspection(input);
  assert.equal(preview.sections.length, kind === "short" ? 1 : 2);
  assert.equal(preview.cues.length, kind === "short" ? 1 : 2);
  assert.ok(preview.text.every((row) => row.inPassage || kind === "short"));
  assert.ok(preview.scripts.intro.length > 0);
  const croppedInput = {
    ...input,
    settings: {
      ...input.settings,
      passageOffsets: { startSeconds: 0.1, endSeconds: -0.1 },
    },
  };
  const cropped = await inspection(croppedInput);
  const paddedSettings = {
    ...croppedInput.settings,
    readingSectionPadding: cropped.sections.map((_, sectionIndex) => ({
      sectionIndex,
      beforeSeconds: 0.05,
      afterSeconds: 0.05,
    })),
  };
  const padded = await inspection({
    ...croppedInput,
    settings: renderSchema.shape.settings.parse(paddedSettings),
  });
  padded.sections.forEach((section, index) => {
    assert.ok(
      Math.abs(
        section.start - Math.max(0, cropped.sections[index].start - 0.05),
      ) < 1e-6,
    );
    assert.ok(
      Math.abs(
        section.end -
          Math.min(section.sourceDuration, cropped.sections[index].end + 0.05),
      ) < 1e-6,
    );
  });
  const { buildVerseReading } = await import("../reading-timeline.js");
  const originalReading = buildVerseReading(
    cropped.sections,
    cropped.cues,
    cropped.cues.map(() => 2),
  );
  const expandedReading = buildVerseReading(
    padded.sections,
    padded.cues,
    padded.cues.map(() => 2),
  );
  expandedReading.sections.forEach((section, index) => {
    assert.equal(section.file, originalReading.sections[index].file);
    assert.ok(
      Math.abs(section.start - originalReading.sections[index].start) < 1e-6,
    );
    assert.ok(
      Math.abs(section.end - originalReading.sections[index].end) < 1e-6,
    );
  });

  if (process.env.VIDEO_SMOKE_PREVIEW === "1") {
    const { createPreview } = await import("../preview.js");
    const selected = preview.cues.at(-1)!;
    // A reading preview needs neither narration nor an existing project directory.
    await assert.rejects(
      fs.stat(
        sourceDir(kind, input.version.id, input.passage.id, outputEnvironment),
      ),
      { code: "ENOENT" },
    );
    const reading = await createPreview({
      ...input,
      readingReferences: [selected.reference],
    });
    assert.equal(reading.props.voices, undefined);
    assert.deepEqual(
      reading.props.verseCues.map((cue) => cue.reference),
      [selected.reference],
    );
    assert.equal(reading.props.verseCues[0].start, 0);
    assert.equal(
      reading.durationInFrames,
      Math.round(reading.props.readingLength * reading.fps),
    );
    assert.ok(
      reading.props.sections.every(
        (section) => section.timelineStart !== undefined,
      ),
    );
    await assert.rejects(
      createPreview({ ...input, readingReferences: ["unknown verse"] }),
      /selected passage is unavailable/,
    );
  }
  // Either narration must be able to create a completely new project on its own.
  for (const part of ["intro", "outro"] as const) {
    const fresh = {
      ...input,
      projectId: Math.floor(Math.random() * 1000000) + 1,
      passage: { ...input.passage, id: `fresh-${part}` },
    };
    const sources = sourceDir(
      kind,
      fresh.version.id,
      fresh.passage.id,
      outputEnvironment,
    );
    const output = projectDir(
      kind,
      fresh.version.id,
      fresh.passage.id,
      outputEnvironment,
    );
    await assert.rejects(fs.stat(sources), { code: "ENOENT" });
    await assert.rejects(fs.stat(output), { code: "ENOENT" });
    await assert.rejects(
      render(fresh, () =>
        assert.fail("Rendering must not start without both voices"),
      ),
      /Generate the introduction and closing voices/,
    );
    await assert.rejects(fs.stat(output), { code: "ENOENT" });
    const progress: number[] = [];
    await generateProjectVoice(fresh, part, (value) => progress.push(value));
    if (process.env.VIDEO_SMOKE_PREVIEW === "1") {
      const { createPreview, previewAsset } = await import("../preview.js");
      // Preview each narration scene while the other voice is still absent.
      const scene = await createPreview({ ...fresh, voicePart: part });
      const scope = {
        projectId: fresh.projectId,
        kind,
        outputEnvironment,
        version: fresh.version.id,
        passage: fresh.passage.id,
      };
      assert.equal(
        previewAsset(scene.props.voices![part], scope),
        path.join(sources, voiceFilename(part)),
      );
      assert.equal(
        scene.durationInFrames,
        Math.round(
          (part === "intro"
            ? scene.props.introLength
            : scene.props.outroLength) * scene.fps,
        ),
      );
    }
    await assert.rejects(
      render(fresh, () =>
        assert.fail("A single voice is insufficient for rendering"),
      ),
      /Generate the introduction and closing voices/,
    );
    assert.equal(progress[0], 5);
    assert.equal(progress.at(-1), 99);
    assert.ok(progress.some((value) => value > 10 && value < 99));
    assert.ok(progress.every((value) => value >= 0 && value <= 100));
    assert.ok((await fs.stat(output)).isDirectory());
    assert.deepEqual(
      (await fs.readdir(sources)).sort(),
      [
        voiceFilename(part, "txt"),
        voiceFilename(part),
        "2-versiculos.txt",
        "README.md",
      ].sort(),
    );
    assert.ok(
      (await fs.stat(path.join(sources, voiceFilename(part)))).size > 44,
    );
    await generateProjectVoice(fresh, part);
    assert.deepEqual(
      (await fs.readdir(sources)).sort(),
      [
        voiceFilename(part, "txt"),
        voiceFilename(part),
        "2-versiculos.txt",
        "README.md",
      ].sort(),
    );
  }
  const voices = sourceDir(
    kind,
    input.version.id,
    input.passage.id,
    outputEnvironment,
  );
  await generateProjectVoice(input, "intro");
  await generateProjectVoice(input, "outro");
  for (const chapter of preview.chapterIntroductions) {
    await generateProjectVoice(input, chapter.part);
    assert.equal(
      await fs.readFile(
        (await projectChapterVoiceFiles(input))
          .find((file) => file.part === chapter.part)!
          .file.replace(/\.wav$/, ".txt"),
        "utf8",
      ),
      chapter.script,
    );
  }
  if (kind === "long") {
    const anotherProject = {
      ...input,
      passage: { ...input.passage, id: "not-generated-yet" },
    };
    const shared = await projectChapterVoiceFiles(anotherProject);
    assert.equal(shared.length, 2);
    assert.ok(shared.every((chapter) => chapter.available && chapter.cached));
    assert.equal(shared[0].file, shared[1].file);
    await assert.rejects(
      fs.stat(
        sourceDir(
          kind,
          input.version.id,
          anotherProject.passage.id,
          outputEnvironment,
        ),
      ),
      { code: "ENOENT" },
    );
  }
  const custom = {
    ...input,
    settings: {
      ...input.settings,
      voiceScriptOverrides: {
        intro: "Introducción manual para este proyecto.",
      },
    },
  };
  await generateProjectVoice(custom, "intro");
  assert.equal(
    await fs.readFile(path.join(voices, voiceFilename("intro", "txt")), "utf8"),
    custom.settings.voiceScriptOverrides.intro,
  );
  if (kind === "long") {
    const chapter = preview.chapterIntroductions[0];
    const sharedFile = (await projectChapterVoiceFiles(input))[0].file;
    const sharedScript = await fs.readFile(
      sharedFile.replace(/\.wav$/, ".txt"),
      "utf8",
    );
    const chapterCustom = {
      ...input,
      settings: {
        ...input.settings,
        voiceScriptOverrides: {
          [chapter.part]: "Capítulo uno. Introducción personalizada.",
        },
      },
    };
    await generateProjectVoice(chapterCustom, chapter.part);
    const customFile = (await projectChapterVoiceFiles(input))[0];
    assert.equal(customFile.cached, false);
    assert.equal(
      await fs.readFile(customFile.file.replace(/\.wav$/, ".txt"), "utf8"),
      chapterCustom.settings.voiceScriptOverrides[chapter.part],
    );
    assert.equal(
      await fs.readFile(sharedFile.replace(/\.wav$/, ".txt"), "utf8"),
      sharedScript,
    );
    await generateProjectVoice(input, chapter.part);
    assert.equal((await projectChapterVoiceFiles(input))[0].cached, true);
  }
  const otherVoice = await fs.readFile(
    path.join(voices, voiceFilename("outro")),
  );
  await generateProjectVoice(input, "intro");
  assert.deepEqual(
    await fs.readFile(path.join(voices, voiceFilename("outro"))),
    otherVoice,
  );
  assert.ok(
    (await fs.stat(path.join(voices, voiceFilename("intro")))).size > 44,
  );
  assert.ok(
    !(await fs.readdir(voices)).some((name) => name.startsWith(".voice-")),
  );
  assert.match(
    await fs.readFile(path.join(voices, voiceFilename("intro", "txt")), "utf8"),
    /Introducción/,
  );
  input.settings.voiceTrims = {
    intro: { startSeconds: 0.05, endSeconds: 0.2 },
    outro: { startSeconds: 0.025, endSeconds: 0.175 },
    ...(kind === "long"
      ? { "chapter-0": { startSeconds: 0.05, endSeconds: 0.15 } }
      : {}),
  };
  // Current waveform cuts must survive request parsing and replace estimated timings.
  input.readingCuts = preview.cues.map((cue) => ({
    reference: cue.reference,
    start: cue.start + (cue.end - cue.start) * 0.15,
    end: cue.end - (cue.end - cue.start) * 0.2,
  }));
  assert.deepEqual(renderSchema.parse(input).readingCuts, input.readingCuts);
  if (process.env.VIDEO_SMOKE_PREVIEW === "1") {
    const { createPreview, previewAsset } = await import("../preview.js");
    if (kind === "long") {
      const chapter = await createPreview({ ...input, voicePart: "chapter-0" });
      assert.equal(chapter.props.chapterIntroductions?.length, 1);
      assert.equal(chapter.props.verseCues.length, 0);
      assert.equal(chapter.props.sections.length, 0);
      assert.equal(
        chapter.durationInFrames,
        Math.round(chapter.props.readingLength * chapter.fps),
      );
    }
    const prepared = await createPreview(input);
    assert.equal(
      prepared.props.chapterIntroductions?.length ?? 0,
      kind === "long" ? 2 : 0,
    );
    assert.equal(prepared.props.voices?.mode, "voice");
    const preparedScope = {
      projectId: input.projectId,
      kind,
      outputEnvironment,
      version: input.version.id,
      passage: input.passage.id,
    };
    assert.equal(
      path.basename(
        previewAsset(prepared.props.introVideoPath, preparedScope)!,
      ),
      "intro-boomerang.mp4",
    );
    assert.equal(
      path.basename(
        previewAsset(prepared.props.outroVideoPath, preparedScope)!,
      ),
      "outro-boomerang.mp4",
    );

    assert.equal(prepared.background, "bg-1.mp4");
    const scope = {
      projectId: input.projectId,
      kind,
      outputEnvironment,
      version: input.version.id,
      passage: input.passage.id,
    };
    const selectedVoice = previewAsset(prepared.props.voices!.intro, scope)!;
    assert.equal(path.basename(selectedVoice), "intro-trimmed.wav");
    assert.ok(
      Math.abs((await audioDurationSeconds(selectedVoice)) - 0.15) < 0.001,
    );
    assert.ok(
      Math.abs(
        (await audioDurationSeconds(
          path.join(voices, voiceFilename("intro")),
        )) - 0.25,
      ) < 0.001,
    );
    assert.equal(
      previewAsset(prepared.props.voices!.intro, {
        ...scope,
        projectId: input.projectId + 1,
      }),
      undefined,
    );
    assert.equal(
      previewAsset(prepared.props.voices!.intro, {
        ...scope,
        outputEnvironment:
          outputEnvironment === "development" ? "production" : "development",
      }),
      undefined,
    );
    assert.equal(previewAsset("preview-../../secrets-0", scope), undefined);
    assert.ok(
      (await fs.stat(previewAsset(prepared.props.boomerangVideoPath, scope)!))
        .size > 100,
    );
    assert.equal(
      prepared.durationInFrames,
      Math.round(prepared.props.introLength * prepared.fps) +
        Math.round(prepared.props.readingLength * prepared.fps) +
        Math.round(prepared.props.outroLength * prepared.fps) -
        2 * Math.round(prepared.props.transitionDuration * prepared.fps),
    );
    const sourceCues = (await analyze(input)).cues;
    assert.deepEqual(
      prepared.props.verseCues.map((cue) => [cue.reference, cue.text]),
      sourceCues.map((cue) => [cue.reference, cue.text]),
    );
    prepared.props.verseCues.forEach((cue, index) => {
      assert.ok(
        Math.abs(
          cue.end -
            cue.start -
            (sourceCues[index].end - sourceCues[index].start),
        ) < 1e-6,
      );
      if (index > 0)
        assert.ok(cue.start > prepared.props.verseCues[index - 1].end);
    });
    assert.ok(
      prepared.props.sections.every(
        (section) => section.timelineStart !== undefined,
      ),
    );
    assert.deepEqual(
      sourceCues.map(({ reference, start, end }) => ({
        reference,
        start,
        end,
      })),
      input.readingCuts,
    );
    // Full previews and rendering read directly from the waveform's original sources.
    prepared.props.sections.forEach((section, index) => {
      const original = preview.sections[index];
      const offset = preview.sections
        .slice(0, index)
        .reduce((sum, value) => sum + value.end - value.start, 0);
      assert.equal(previewAsset(section.file, scope), original.file);
      assert.ok(
        Math.abs(
          section.start -
            (original.start + input.readingCuts![index].start - offset),
        ) < 1e-6,
      );
      assert.ok(
        Math.abs(
          section.end -
            (original.start + input.readingCuts![index].end - offset),
        ) < 1e-6,
      );
    });
    if (process.env.VIDEO_SMOKE_RENDER !== "1")
      await assert.rejects(
        fs.stat(
          path.join(
            projectDir(
              kind,
              input.version.id,
              input.passage.id,
              outputEnvironment,
            ),
            kind === "short" ? "0-short.mp4" : "0-episode.mp4",
          ),
        ),
        { code: "ENOENT" },
      );
  }
  if (process.env.VIDEO_SMOKE_RENDER === "1") {
    const cliOffsets = path.join(voices, "2-passage-audio-offsets.json");
    const cliSettings = '{"startSeconds":0,"endSeconds":0}\n';
    await fs.writeFile(cliOffsets, cliSettings);
    const introVoice = await fs.readFile(
      path.join(voices, voiceFilename("intro")),
    );
    const output = path.dirname(voices);
    for (const name of [
      kind === "short" ? "short.mp4" : "episode.mp4",
      "thumbnail.jpg",
      "youtube.txt",
      "1-instagram.txt",
    ])
      await fs.writeFile(path.join(output, name), "obsolete output");
    const result = await render(input, () => {});
    assert.deepEqual(
      await fs.readFile(path.join(voices, voiceFilename("intro"))),
      introVoice,
    );
    assert.equal(await fs.readFile(cliOffsets, "utf8"), cliSettings);
    assert.deepEqual(
      await fs.readFile(path.join(voices, voiceFilename("outro"))),
      otherVoice,
    );
    assert.ok(
      result.descriptions["3.2-youtube.txt"].includes(
        "https://veobible.com/es/rv1909/genesis/1\n",
      ),
    );
    assert.equal(
      await fs.readFile(
        path.join(path.dirname(result.video), "3.2-youtube.txt"),
        "utf8",
      ),
      result.descriptions["3.2-youtube.txt"],
    );
    assert.ok((await fs.stat(result.video)).size > 100);
    assert.ok((await fs.stat(result.thumbnail)).size > 100);
    assert.equal(result.verseCues.length, kind === "short" ? 1 : 2);
    assert.deepEqual(
      result.verseCues.map(({ reference, start, end }) => ({
        reference,
        start,
        end,
      })),
      input.readingCuts,
    );
    assert.ok(result.sources.every((file) => file.startsWith(working)));
    assert.deepEqual(
      (await fs.readdir(path.dirname(result.video))).sort(),
      [
        "_internal",
        "2-facebook.txt",
        ...(kind === "short" ? ["1-instagram.txt"] : []),
        "3.3-thumbnail.jpg",
        "4-tiktok.txt",
        ...(kind === "short" ? ["0-short.mp4"] : ["0-episode.mp4"]),
        "5-x.txt",
        "3.1-youtube.txt",
        "3.2-youtube.txt",
      ].sort(),
    );
    assert.deepEqual((await fs.readdir(voices)).sort(), [
      "0-metadata.txt",
      "1-intro.txt",
      "1-intro.wav",
      ...preview.chapterIntroductions
        .filter((chapter) => !chapter.complete)
        .flatMap((chapter) => [
          voiceFilename(chapter.part, "txt"),
          voiceFilename(chapter.part),
        ]),
      "2-passage-audio-offsets.json",
      "2-versiculos.txt",
      "3-outro.txt",
      "3-outro.wav",
      "README.md",
      "render-result.json",
    ]);
  }
}
console.log("standalone pipeline passed: short, long");
if (process.env.VIDEO_SMOKE_RENDER === "1")
  console.log("standalone renders passed: short, long");
