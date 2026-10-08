import { applyReadingCuts, expandReadingContext } from "./reading-timeline.js";
import fs from "node:fs/promises";
import path from "node:path";
import { outputRoot, type OutputEnvironment } from "./working-directories.js";
import * as short from "./engines/short/shorts.js";
import * as long from "./engines/long/episodes.js";
import * as shortVoice from "./engines/short/voice.js";
import * as longVoice from "./engines/long/voice.js";
import * as shortVideo from "./engines/short/video.js";
import * as longVideo from "./engines/long/video.js";
import * as shortTiming from "./engines/short/verse-timing.js";
import * as longTiming from "./engines/long/verse-timing.js";
import { config as shortConfig } from "./engines/short/config.js";
import { config as longConfig } from "./engines/long/config.js";
import { outroTitle as shortOutro } from "./engines/short/social.js";
import { outroTitle as longOutro } from "./engines/long/social.js";
import { publicationDescriptions as shortDescriptions } from "./engines/short/publication.js";
import { publicationDescriptions as longDescriptions } from "./engines/long/publication.js";
import type { RenderRequest } from "./protocol.js";
export const projectDir = (
  kind: string,
  version: string,
  passage: string,
  environment: OutputEnvironment = "production",
) => {
  for (const segment of [version, passage])
    if (!/^[a-z0-9-]+$/.test(segment))
      throw new Error("Invalid output identifier");
  return path.join(outputRoot(kind, environment), version, passage);
};
export const sourceDir = (
  kind: string,
  version: string,
  passage: string,
  environment: OutputEnvironment = "production",
) => path.join(projectDir(kind, version, passage, environment), "_internal");
export const voiceFilename = (part: "intro" | "outro", extension = "wav") =>
  `${part === "intro" ? "1" : "3"}-${part}.${extension}`;
export const videoFilename = (kind: string) =>
  kind === "short" ? "short.mp4" : "episode.mp4";
async function prepareProjectDirectories(
  input: Pick<
    RenderRequest,
    "kind" | "version" | "passage" | "outputEnvironment"
  >,
) {
  const output = projectDir(
    input.kind,
    input.version.id,
    input.passage.id,
    input.outputEnvironment,
  );
  const sources = sourceDir(
    input.kind,
    input.version.id,
    input.passage.id,
    input.outputEnvironment,
  );
  await fs.mkdir(sources, { recursive: true });
  return { output, sources };
}
async function generateNamedVoice(
  sources: string,
  voice: typeof shortVoice | typeof longVoice,
  context: shortVoice.VoiceContext,
  part: "intro" | "outro",
  onProgress?: (progress: number) => void,
) {
  const staging = await fs.mkdtemp(path.join(sources, ".voice-"));
  try {
    await voice.generateVoice(staging, context, true, part, onProgress);
    for (const extension of ["wav", "txt"])
      await fs.rename(
        path.join(staging, `${part}.${extension}`),
        path.join(sources, voiceFilename(part, extension)),
      );
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
async function writePassageFiles(
  sources: string,
  data: Awaited<ReturnType<typeof analyze>>["data"],
) {
  await fs.writeFile(
    path.join(sources, "2-versiculos.txt"),
    `${data.label} — ${data.index.metadata.name}\n\n${data.lines.join("\n")}\n`,
    "utf8",
  );
  try {
    await fs.writeFile(
      path.join(sources, "README.md"),
      "# Project files\n\n1-intro.wav and 3-outro.wav contain the narrations; their matching text files contain the spoken scripts.\n2-versiculos.txt contains the passage text. 0-metadata.txt describes the rendered video.\n\nDashboard timing and audio settings are stored in the database. Legacy timing files, when present, are preserved and can be synchronized from the dashboard.\n",
      { flag: "wx" },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
function modules(kind: "short" | "long") {
  return kind === "short"
    ? {
        passages: short,
        voice: shortVoice,
        video: shortVideo,
        timing: shortTiming,
        config: shortConfig,
        outro: shortOutro,
        descriptions: shortDescriptions,
      }
    : {
        passages: long,
        voice: longVoice,
        video: longVideo,
        timing: longTiming,
        config: longConfig,
        outro: longOutro,
        descriptions: longDescriptions,
      };
}
export async function analyze(
  input: Pick<
    RenderRequest,
    "kind" | "passage" | "version" | "settings" | "voiceTemplates" | "readingCuts"
  >,
) {
  const m = modules(input.kind);
  const version = m.config.versions.find((v) => v.id === input.version.id);
  if (!version || version.locale !== input.version.locale)
    throw new Error("Invalid Bible version");
  const data = await m.passages.analyzePassageAudio(version, input.passage);
  const originalSections = m.passages.applyPassageAudioOffsets(
    data.sections,
    data.sourceDurations,
    input.settings.passageOffsets,
  );
  const estimates = await m.timing.estimateVerseCues(
    data.timingInputs.map((v, i) => ({ ...v, section: originalSections[i] })),
  );
  const expanded = expandReadingContext(originalSections, estimates, data.sourceDurations, input.settings.readingSectionPadding);
  const sections = expanded.sections;
  const sourceDuration = sections.reduce((total, section) => total + section.end - section.start, 0);
  const cues = applyReadingCuts(
    input.readingCuts ? expanded.cues : m.timing.applyVerseOffsets(expanded.cues, input.settings.verseOffsets, sourceDuration),
    input.readingCuts,
    sourceDuration,
  );
  const context = m.voice.voiceContext(
    version,
    input.passage,
    data.book.name,
    data.index.metadata.name,
    input.voiceTemplates,
  );
  return { data, sections, cues, context, version, m };
}
export async function inspection(
  input: Pick<
    RenderRequest,
    "kind" | "passage" | "version" | "settings" | "voiceTemplates"
  >,
) {
  const { data, sections, cues, context, version, m } = await analyze(input);
  return {
    label: data.label,
    lines: data.lines,
    sections: sections.map((section, index) => ({ ...section, sourceDuration: data.sourceDurations[index] })),
    cues,
    scripts: await m.voice.renderVoiceScripts(context),
    text: await m.passages.readPassageTextContext(
      version,
      input.passage,
      data.index,
    ),
    backgrounds: (await m.video.backgroundVideos(m.config.videosDir)).map((f) =>
      path.basename(f),
    ),
  };
}
/** Generate one fixed narration without rendering a video or touching the other voice. */
export async function generateProjectVoice(
  input: Pick<
    RenderRequest,
    | "kind"
    | "passage"
    | "version"
    | "settings"
    | "voiceTemplates"
    | "projectId"
    | "outputEnvironment"
  >,
  part: "intro" | "outro",
  update: (progress: number) => void = () => {},
) {
  update(5);
  const { sources } = await prepareProjectDirectories(input);
  const { context, m, data } = await analyze({
    ...input,
    settings: { ...input.settings, verseOffsets: [] },
  });
  await writePassageFiles(sources, data);
  update(10);
  await generateNamedVoice(sources, m.voice, context, part, (progress) =>
    update(10 + progress * 0.85),
  );
  update(99);
}

/** Final renders only consume narration explicitly generated beforehand. */
export async function existingProjectVoices(
  input: Pick<
    RenderRequest,
    "kind" | "version" | "passage" | "outputEnvironment"
  >,
) {
  const sources = sourceDir(
    input.kind,
    input.version.id,
    input.passage.id,
    input.outputEnvironment,
  );
  const tracks = {
    intro: path.join(sources, voiceFilename("intro")),
    outro: path.join(sources, voiceFilename("outro")),
  };
  const available = await Promise.all(
    Object.values(tracks).map((file) =>
      fs.stat(file).then(
        (stat) => stat.isFile() && stat.size > 0,
        () => false,
      ),
    ),
  );
  return available.every(Boolean) ? tracks : null;
}

export async function render(
  input: RenderRequest,
  update: (stage: string, progress?: number) => void,
) {
  const existingVoices = await existingProjectVoices(input);
  if (!existingVoices)
    throw new Error(
      "Generate the introduction and closing voices before generating the video.",
    );
  update("Analizando pasaje y tiempos", 2);
  const { data, sections, cues, context, version, m } = await analyze(input);
  const { output, sources } = await prepareProjectDirectories(input);
  await writePassageFiles(sources, data);
  const scripts = await m.voice.renderVoiceScripts(context);
  update("Preparando narraciones", 20);
  const voices: shortVideo.VoiceTracks = {
    ...existingVoices,
    mode: "voice",
  };
  const work = await fs.mkdtemp(path.join(output, ".render-"));
  try {
    update("Renderizando con Remotion", 45);
    const title =
      input.kind === "short"
        ? short.introTitle(version.locale, data.label, data.index.metadata.name)
        : long.introTitle(
            version.locale,
            data.label,
            data.index.metadata.name,
            input.passage.episode,
          );
    const renderer =
      input.kind === "short"
        ? shortVideo.renderShortVideo
        : longVideo.renderEpisodeVideo;
    const final = path.join(work, "video.mp4");
    const result = await renderer(
      final,
      sections,
      m.config.videosDir,
      title,
      await m.outro(version.locale, input.socialAccounts),
      cues,
      voices,
      work,
      input.settings.volumeMultiplier,
      {
        background: input.settings.background,
        onProgress: (progress) =>
          update("Renderizando con Remotion", 45 + progress * 50),
      },
    );
    update("Generando miniatura", 96);
    await m.video.generateThumbnail(
      final,
      path.join(work, "thumbnail.jpg"),
      result.thumbnailTime,
    );
    await fs.rename(final, path.join(output, videoFilename(input.kind)));
    await fs.rename(
      path.join(work, "thumbnail.jpg"),
      path.join(output, "thumbnail.jpg"),
    );
    const descriptions = m.descriptions(version.locale, title, data.lines);
    for (const [name, text] of Object.entries(descriptions))
      await fs.writeFile(path.join(output, name), text, "utf8");
    await fs.writeFile(
      path.join(sources, "0-metadata.txt"),
      [
        `Reference: ${data.label}`,
        `Passage ID: ${input.passage.id}`,
        `Language: ${version.locale}`,
        `Version: ${data.index.metadata.name} (${version.id})`,
        `Book: ${data.book.name} (${data.book.id})`,
        `Start: ${input.passage.start.chapter}:${input.passage.start.verse}`,
        `End: ${input.passage.end.chapter}:${input.passage.end.verse}`,
        `Final video: ../${videoFilename(input.kind)}`,
        `Thumbnail: ../thumbnail.jpg (frame at ${result.thumbnailTime.toFixed(6)} s)`,
        `Background: ${result.background}`,
        "Narration mode: voice",
        `Reading volume: ${input.settings.volumeMultiplier}x`,
        `Reading duration: ${result.readingDuration.toFixed(2)} s`,
        `Video duration: ${result.duration.toFixed(2)} s`,
        `Bible audio: ${sections.map((section) => `${section.file} [${section.start.toFixed(6)}–${section.end.toFixed(6)} s]`).join(", ")}`,
        `Passage offsets: start ${input.settings.passageOffsets.startSeconds} s; end ${input.settings.passageOffsets.endSeconds} s`,
        `Verse timings: ${cues.map((cue) => `${cue.reference} [${cue.start.toFixed(6)}–${cue.end.toFixed(6)} s]`).join(", ")}`,
        "Settings source: dashboard database",
        "Text: 2-versiculos.txt",
        "",
      ].join("\n"),
      "utf8",
    );
    const savedResult = {
      ...result,
      output,
      video: path.join(output, videoFilename(input.kind)),
      thumbnail: path.join(output, "thumbnail.jpg"),
      descriptions,
      voiceScripts: scripts,
      sources: [
        ...sections.map((s) => s.file),
        path.join(m.config.videosDir, "0-intro.mp4"),
        path.join(m.config.videosDir, result.background),
        path.join(m.config.videosDir, "0-outro.mp4"),
        ...(voices ? [voices.intro, voices.outro] : []),
      ],
      verseCues: cues,
    };
    await fs.writeFile(
      path.join(sources, "render-result.json"),
      JSON.stringify(savedResult),
      "utf8",
    );
    return savedResult;
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}
