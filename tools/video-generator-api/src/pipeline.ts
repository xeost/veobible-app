import fs from "node:fs/promises";
import path from "node:path";
import { outputRoot, mediaRoot } from "./working-directories.js";
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
export const projectDir = (kind: string, id: string) =>
  path.join(outputRoot(kind), id);
export const sourceDir = (kind: string, id: string) =>
  path.join(mediaRoot(kind), "sources", id);
async function prepareProjectDirectories(kind: string, id: string) {
  const output = projectDir(kind, id);
  const sources = sourceDir(kind, id);
  await Promise.all([
    fs.mkdir(output, { recursive: true }),
    fs.mkdir(sources, { recursive: true }),
  ]);
  return { output, sources };
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
    "kind" | "passage" | "version" | "settings" | "voiceTemplates"
  >,
) {
  const m = modules(input.kind);
  const version = m.config.versions.find((v) => v.id === input.version.id);
  if (!version || version.locale !== input.version.locale)
    throw new Error("Invalid Bible version");
  const data = await m.passages.analyzePassageAudio(version, input.passage);
  const sections = m.passages.applyPassageAudioOffsets(
    data.sections,
    data.sourceDurations,
    input.settings.passageOffsets,
  );
  const estimates = await m.timing.estimateVerseCues(
    data.timingInputs.map((v, i) => ({ ...v, section: sections[i] })),
  );
  const cues = m.timing.applyVerseOffsets(
    estimates,
    input.settings.verseOffsets,
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
    sections,
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
    "kind" | "passage" | "version" | "settings" | "voiceTemplates" | "projectId"
  >,
  part: "intro" | "outro",
) {
  const { sources } = await prepareProjectDirectories(
    input.kind,
    input.projectId,
  );
  const { context, m } = await analyze({
    ...input,
    settings: { ...input.settings, verseOffsets: [] },
  });
  try {
    await m.voice.generateVoice(sources, context, true, part);
  } finally {
    await fs.rm(path.join(sources, `${part}.txt`), { force: true });
  }
}

export async function render(
  input: RenderRequest,
  update: (stage: string) => void,
) {
  update("Analizando pasaje y tiempos");
  const { data, sections, cues, context, version, m } = await analyze(input);
  const { output, sources } = await prepareProjectDirectories(
    input.kind,
    input.projectId,
  );
  const scripts = await m.voice.renderVoiceScripts(context);
  let voices: shortVideo.VoiceTracks | undefined;
  if (input.settings.clipAudioMode !== "video") {
    const exists = await Promise.all(
      ["intro.wav", "outro.wav"].map((f) =>
        fs.access(path.join(sources, f)).then(
          () => true,
          () => false,
        ),
      ),
    );
    if (!input.settings.reuseVoices || !exists.every(Boolean)) {
      update("Generando voces con IA local");
      // Synthesis request files are temporary; D1 owns scripts and settings.
      try {
        await m.voice.generateVoice(sources, context, true);
      } finally {
        await Promise.all(
          ["intro.txt", "outro.txt"].map((f) =>
            fs.rm(path.join(sources, f), { force: true }),
          ),
        );
      }
    }
    voices = {
      intro: path.join(sources, "intro.wav"),
      outro: path.join(sources, "outro.wav"),
      mode: input.settings.clipAudioMode,
    };
  }
  const work = await fs.mkdtemp(path.join(output, ".render-"));
  try {
    update("Renderizando con Remotion");
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
      { background: input.settings.background },
    );
    update("Generando miniatura");
    await m.video.generateThumbnail(
      final,
      path.join(work, "thumbnail.jpg"),
      result.thumbnailTime,
    );
    await fs.rename(final, path.join(output, "video.mp4"));
    await fs.rename(
      path.join(work, "thumbnail.jpg"),
      path.join(output, "thumbnail.jpg"),
    );
    return {
      ...result,
      output,
      video: path.join(output, "video.mp4"),
      thumbnail: path.join(output, "thumbnail.jpg"),
      descriptions: m.descriptions(version.locale, title, data.lines),
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
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}
