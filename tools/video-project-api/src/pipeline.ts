import { selectedRoleVoice } from "./base-voice-schema.js";
import { AudioProjects } from "./audio-projects.js";
import { baseVoiceSample } from "./base-voice.js";
import { type NarrationParameters } from "./narration-parameters.js";
import {
  type NarrationModel,
  narrationModelForLocale,
} from "./narration-models.js";
import { prepareTrimmedVoice } from "./voice-trim.js";
import {
  migrateReadingVerses,
  assembleReadingVerses,
  readingVerseFile,
} from "./reading-voice-files.js";
import {
  videoFilename,
  thumbnailFilename,
  publicationFilenames,
  isPublicationFilename,
  isNumberedThumbnailFilename,
} from "./output-files.js";
export { videoFilename } from "./output-files.js";
import { publicationDescriptions } from "./publication.js";
import { publicationPassageUrl } from "./publication.js";
import { chapterVoiceCache } from "./chapter-voice-cache.js";
import { episodeReference } from "./episode-reference.js";
import {
  chapterIntroductionText,
  type VoicePart,
  type ChapterIntroduction,
} from "./chapter-introductions.js";
import { applyReadingCuts, expandReadingContext } from "./reading-timeline.js";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  outputRoot,
  workingDirectories,
  sharedAudioDirectory,
  audioOutputRoot,
  type OutputEnvironment,
} from "./working-directories.js";
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
/** Cache chapter announcements by synthesis configuration, independently of project/version. */
export function chapterSynthesis(
  locale: "es" | "en" | "pt",
  selected?: NarrationModel,
  parameters?: NarrationParameters,
  baseVoice?: string,
  decoder?: "general" | "v3",
) {
  const model = selected ?? longConfig.ttsModels[locale];
  // Every local model must isolate recordings made with the shared base sample.
  // External providers keep their existing cache behavior.
  if (!selected && longConfig.ttsProvider !== "chatterbox") return undefined;
  return createHash("sha256")
    .update(
      JSON.stringify({
        provider: selected ? "chatterbox" : longConfig.ttsProvider,
        model:
          selected || longConfig.ttsProvider === "chatterbox"
            ? ["multilingual", "multilingual-v3"].includes(model)
              ? "multilingual-v3"
              : model
            : longConfig.elevenLabsModel,
        voice:
          selected || longConfig.ttsProvider === "chatterbox"
            ? baseVoiceSample(locale, baseVoice)
            : longConfig.elevenLabsVoices[locale],
        script: longConfig.ttsScript,
        ...(parameters ? { parameters } : {}),
        decoder:
          decoder ??
          (model === "latam"
            ? "general"
            : model === "pt-br"
              ? "v3"
              : "default"),
      }),
    )
    .digest("hex")
    .slice(0, 24);
}
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
export const voiceFilename = (part: VoicePart, extension = "wav") =>
  part.startsWith("reading-")
    ? `4-${part}.${extension}`
    : part.startsWith("chapter-")
      ? `2-${part}.${extension}`
      : `${part === "intro" ? "1" : "3"}-${part}.${extension}`;
async function prepareProjectDirectories(
  input: Pick<
    RenderRequest,
    | "kind"
    | "version"
    | "passage"
    | "outputEnvironment"
    | "voiceModel"
    | "voiceDecoder"
    | "voiceParameters"
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
  alignment: {
    language: string;
    ffmpeg: string;
    duration: (file: string) => Promise<number>;
  },
  onProgress?: (progress: number) => void,
) {
  const staging = await fs.mkdtemp(path.join(sources, ".voice-"));
  try {
    await voice.generateVoice(staging, context, true, part, (progress) =>
      onProgress?.(progress * 0.7),
    );
    const audio = path.join(staging, `${part}.wav`);
    const duration = await alignment.duration(audio);
    const text = (
      await fs.readFile(path.join(staging, `${part}.txt`), "utf8")
    ).trim();
    const { alignGeneratedSpeech } = await import("./forced-alignment.js");
    const {
      cues: [cue],
      model,
    } = await alignGeneratedSpeech(
      audio,
      duration,
      alignment.language,
      [{ id: part, text, start: 0, end: duration }],
      alignment.ffmpeg,
      (progress) => onProgress?.(70 + progress * 0.3),
    );
    await fs.writeFile(
      path.join(staging, `${part}.wav.json`),
      JSON.stringify({
        duration,
        trim: { startSeconds: cue.start, endSeconds: cue.end },
        alignment: { method: "forced", model, version: 1 },
        synthesis: {
          model: context.voiceModel,
          decoder:
            context.voiceDecoder ??
            (context.voiceModel === "latam"
              ? "general"
              : context.voiceModel === "pt-br"
                ? "v3"
                : undefined),
          parameters: context.voiceParameters,
        },
      }),
    );
    for (const extension of ["wav", "txt", "wav.json"])
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
const bookDescriptions: typeof longDescriptions = (
  locale,
  title,
  verses,
  templates = {},
  passageUrl = "",
) =>
  publicationDescriptions(locale, title, verses, templates, "book", passageUrl);

function modules(kind: "short" | "long" | "book") {
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
        config:
          kind === "book"
            ? {
                ...longConfig,
                workingDir: workingDirectories.book,
                videosDir: path.join(
                  workingDirectories.book,
                  "material",
                  "videos",
                ),
                audioDir: process.env.VIDEO_AUDIO_DIR ?? sharedAudioDirectory,
              }
            : longConfig,
        outro: longOutro,
        descriptions: kind === "book" ? bookDescriptions : longDescriptions,
      };
}
const readingText = (text: string) =>
  text
    .replace(/\(H\d+-\d+\)/g, "")
    .replace(/\s+/gu, " ")
    .trim();

async function readingVoiceFiles(
  input: {
    kind: string;
    version: { id: string };
    passage: { id: string };
    outputEnvironment?: OutputEnvironment;
  },
  data: Awaited<ReturnType<typeof short.analyzePassageAudio>>,
) {
  const directory = sourceDir(
    input.kind,
    input.version.id,
    input.passage.id,
    input.outputEnvironment,
  );
  return Promise.all(
    data.timingInputs.map(async (timing, index) => {
      const file = path.join(directory, voiceFilename(`reading-${index}`));
      const expected = timing.verses.map(
        (verse) => `${timing.bookName} ${timing.chapter}:${verse.verse}`,
      );
      try {
        const saved = JSON.parse(await fs.readFile(file + ".json", "utf8")) as {
          duration: number;
          cues: shortTiming.VerseCue[];
          alignment?: { method: "forced"; model: string; version: number };
        };
        const stat = await fs.stat(file);
        if (
          !stat.size ||
          !Number.isFinite(saved.duration) ||
          saved.duration <= 0 ||
          saved.cues.length !== expected.length ||
          saved.cues.some(
            (cue, i) =>
              cue.reference !== expected[i] ||
              !Number.isFinite(cue.start) ||
              !Number.isFinite(cue.end) ||
              cue.start < 0 ||
              cue.end <= cue.start ||
              cue.end > saved.duration,
          )
        )
          throw new Error("Invalid generated reading");
        return {
          file,
          available: true,
          duration: saved.duration,
          revision: Math.max(
            stat.mtimeMs,
            (await fs.stat(file + ".json")).mtimeMs,
          ),
          alignment: saved.alignment,
          cues: saved.cues.map((cue, i) => ({
            ...cue,
            text: readingText(timing.verses[i].text),
          })),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          console.error("Generated reading unavailable", error);
        return {
          file,
          available: false,
          duration: 0,
          revision: 0,
          cues: [] as shortTiming.VerseCue[],
        };
      }
    }),
  );
}
export async function analyze(
  input: Pick<
    RenderRequest,
    | "kind"
    | "passage"
    | "version"
    | "settings"
    | "voiceTemplates"
    | "voiceModel"
    | "voiceDecoder"
    | "voiceParameters"
    | "readingCuts"
  > & { outputEnvironment?: OutputEnvironment },
  options: { originalOnly?: boolean } = {},
) {
  const m = modules(input.kind);
  const version = m.config.versions.find((v) => v.id === input.version.id);
  if (!version || version.locale !== input.version.locale)
    throw new Error("Invalid Bible version");
  if (input.settings.audioEdition) {
    const { marker } = await new AudioProjects(
      undefined,
      input.outputEnvironment,
    ).owned(input.settings.audioEdition);
    if (
      marker.version.code !== version.id ||
      marker.version.locale !== version.locale
    )
      throw new Error("Audio version does not match the Bible version.");
  }
  const data = await m.passages.analyzePassageAudio(
    version,
    input.passage,
    true,
    input.settings.audioEdition
      ? audioOutputRoot(input.outputEnvironment)
      : m.config.audioDir,
    input.settings.audioEdition ?? version.id,
  );
  const originalSections = m.passages.applyPassageAudioOffsets(
    data.sections,
    data.sourceDurations,
    {
      startSeconds: data.sections[0]?.file
        ? input.settings.passageOffsets.startSeconds
        : 0,
      endSeconds: data.sections.at(-1)?.file
        ? input.settings.passageOffsets.endSeconds
        : 0,
    },
  );
  const estimates = await m.timing.estimateVerseCues(
    data.timingInputs.map((v, i) => ({ ...v, section: originalSections[i] })),
  );
  const expanded = expandReadingContext(
    originalSections,
    estimates,
    data.sourceDurations,
    input.settings.readingSectionPadding.filter(
      (entry) => data.sections[entry.sectionIndex]?.file !== "",
    ),
  );
  let sections = expanded.sections;
  const sourceDuration = sections.reduce(
    (total, section) => total + section.end - section.start,
    0,
  );
  const generatedReferences = new Set(
    !options.originalOnly
      ? data.timingInputs.flatMap((timing, index) =>
          input.settings.readingVoices?.[index]?.enabled ||
          !data.sections[index].file
            ? timing.verses.map(
                (verse) =>
                  `${timing.bookName} ${timing.chapter}:${verse.verse}`,
              )
            : [],
        )
      : [],
  );
  const originalCuts = input.readingCuts?.map((cut) =>
    generatedReferences.has(cut.reference)
      ? {
          ...cut,
          start:
            expanded.cues.find((cue) => cue.reference === cut.reference)
              ?.start ?? cut.start,
          end:
            expanded.cues.find((cue) => cue.reference === cut.reference)?.end ??
            cut.end,
        }
      : cut,
  );
  let cues = applyReadingCuts(
    originalCuts
      ? expanded.cues
      : m.timing.applyVerseOffsets(
          expanded.cues,
          input.settings.verseOffsets.filter(
            (cut) => !generatedReferences.has(cut.reference),
          ),
          sourceDuration,
        ),
    originalCuts,
    sourceDuration,
  );
  if (!options.originalOnly) {
    const generated = await readingVoiceFiles(input, data);
    const nextSections = [];
    const nextCues = [];
    let originalOffset = 0,
      nextOffset = 0;
    for (let index = 0; index < sections.length; index++) {
      const section = sections[index];
      const length = section.end - section.start;
      const active =
        input.settings.readingVoices?.[index]?.enabled ||
        !data.sections[index].file;
      if (active) {
        const track = generated[index];
        if (!track.available)
          throw new Error(
            "Generate the selected passage reading before previewing or rendering.",
          );
        const adjusted = m.timing.applyVerseOffsets(
          track.cues,
          input.settings.readingVoices?.[index]?.verseOffsets ?? [],
          track.duration,
        );
        nextSections.push({ file: track.file, start: 0, end: track.duration });
        nextCues.push(
          ...adjusted.map((cue) => ({
            ...cue,
            start: cue.start + nextOffset,
            end: cue.end + nextOffset,
          })),
        );
        nextOffset += track.duration;
      } else {
        nextSections.push(section);
        const references = new Set(
          data.timingInputs[index].verses.map(
            (verse) =>
              `${data.timingInputs[index].bookName} ${data.timingInputs[index].chapter}:${verse.verse}`,
          ),
        );
        nextCues.push(
          ...cues
            .filter((cue) => references.has(cue.reference))
            .map((cue) => ({
              ...cue,
              start: cue.start - originalOffset + nextOffset,
              end: cue.end - originalOffset + nextOffset,
            })),
        );
        nextOffset += length;
      }
      originalOffset += length;
    }
    sections = nextSections;
    cues = nextCues;
  }
  const context = m.voice.voiceContext(
    version,
    input.passage,
    data.book.name,
    data.index.metadata.name,
    input.voiceTemplates,
  );
  context.voiceParameters = input.voiceParameters;
  context.voiceDecoder = input.voiceDecoder;
  context.baseVoice = input.settings.baseVoice;
  context.scriptOverrides = input.settings.voiceScriptOverrides;
  context.voiceModel =
    input.voiceModel === undefined
      ? undefined
      : narrationModelForLocale(input.voiceModel, input.version.locale);
  const episodeContent =
    input.kind !== "short"
      ? episodeReference(
          long.passageChapters(data.index, input.passage),
          version.locale,
          (n) => longVoice.numberToWords(version.locale, n),
          (name) => longVoice.spokenBookName(version.locale, name),
        )
      : null;
  if (episodeContent) {
    context.reference = episodeContent.spoken;
    context.start = episodeContent.start;
    context.end = episodeContent.end;
  }
  const chapterIntroductions: ChapterIntroduction[] =
    input.kind !== "short"
      ? long.passageChapters(data.index, input.passage).map((range, index) => {
          const { title, script } = chapterIntroductionText(
            version.locale,
            { ...range, total: range.book.versesPerChapter[range.chapter - 1] },
            (n) => longVoice.numberToWords(version.locale, n),
          );
          return {
            part: `chapter-${index}` as const,
            chapter: range.chapter,
            complete:
              range.first === 1 &&
              range.last === range.book.versesPerChapter[range.chapter - 1],
            bookName: range.book.name,
            title,
            script,
            references: data.timingInputs[index].verses.map(
              (v) => `${range.book.name} ${range.chapter}:${v.verse}`,
            ),
          };
        })
      : [];
  return {
    data,
    sections,
    cues,
    context,
    version,
    m,
    chapterIntroductions,
    episodeContent,
  };
}
export async function inspection(
  input: Pick<
    RenderRequest,
    | "kind"
    | "passage"
    | "version"
    | "settings"
    | "voiceTemplates"
    | "voiceModel"
    | "voiceDecoder"
    | "voiceParameters"
  > & { outputEnvironment?: OutputEnvironment },
) {
  const {
    data,
    sections,
    cues,
    context,
    version,
    m,
    chapterIntroductions,
    episodeContent,
  } = await analyze(
    { ...input, readingCuts: undefined },
    { originalOnly: true },
  );
  return {
    generatedReadings: await readingVoiceFiles(input, data),
    label: data.label,
    lines: data.lines,
    sections: sections.map((section, index) => ({
      ...section,
      sourceDuration: data.sourceDurations[index],
      originalAvailable: Boolean(data.sections[index].file),
    })),
    cues,
    chapterIntroductions,
    scripts: await m.voice.renderVoiceScripts({
      ...context,
      scriptOverrides: undefined,
    }),
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
    | "voiceModel"
    | "voiceDecoder"
    | "voiceParameters"
    | "projectId"
    | "outputEnvironment"
  > & { verseReference?: string },
  part: VoicePart,
  update: (progress: number) => void = () => {},
) {
  update(5);
  const { sources } = await prepareProjectDirectories(input);
  const { context, m, data, chapterIntroductions } = await analyze(
    {
      ...input,
      readingCuts: undefined,
      settings: { ...input.settings, verseOffsets: [] },
    },
    { originalOnly: true },
  );
  await writePassageFiles(sources, data);
  update(10);
  context.baseVoice = selectedRoleVoice(
    input.settings,
    input.version.locale,
    part === "outro"
      ? "outro"
      : part.startsWith("reading-")
        ? "reading"
        : "intro",
  );
  if (part.startsWith("reading-")) {
    const index = Number(part.slice(8));
    const timing = data.timingInputs[index];
    if (!timing) throw new Error("Invalid reading block");
    const verses = timing.verses.map((verse) => ({
      verse: verse.verse,
      reference: `${timing.bookName} ${timing.chapter}:${verse.verse}`,
      text: readingText(verse.text),
    }));
    const selected = input.verseReference
      ? verses.filter((verse) => verse.reference === input.verseReference)
      : verses;
    if (!selected.length) throw new Error("Invalid reading verse");
    await fs.mkdir(path.join(sources, part), { recursive: true });
    await migrateReadingVerses(
      sources,
      part,
      verses,
      m.config.ffmpegBin,
      input.settings.readingVoices?.[index]?.verseOffsets,
    );
    for (const [position, verse] of selected.entries()) {
      const staging = await fs.mkdtemp(path.join(sources, part, ".voice-"));
      const progress = (value: number) =>
        update(10 + (88 * (position + value / 100)) / selected.length);
      try {
        // Each verse is its own synthesis request, including its own model lifecycle.
        await m.voice.generateVoice(
          staging,
          {
            ...context,
            singleUtterance: true,
            scriptOverrides: { intro: verse.text },
          },
          true,
          "intro",
          (value) => progress(value * 0.7),
        );
        const generated = path.join(staging, "intro.wav");
        const duration = await m.passages.audioDurationSeconds(generated);
        const { alignGeneratedSpeech } = await import("./forced-alignment.js");
        const { cues, model } = await alignGeneratedSpeech(
          generated,
          duration,
          input.version.locale,
          [{ id: verse.reference, text: verse.text, start: 0, end: duration }],
          m.config.ffmpegBin,
          (value) => progress(70 + value * 0.3),
        );
        const target = readingVerseFile(sources, part, verse.verse);
        await fs.writeFile(
          generated + ".json",
          JSON.stringify({
            duration,
            cues,
            alignment: { method: "forced", model, version: 1 },
            synthesis: {
              model: context.voiceModel,
              decoder:
                context.voiceDecoder ??
                (context.voiceModel === "latam"
                  ? "general"
                  : context.voiceModel === "pt-br"
                    ? "v3"
                    : undefined),
              parameters: context.voiceParameters,
            },
          }),
        );
        await fs.rename(generated, target);
        await fs.rename(generated + ".json", target + ".json");
        await fs.rename(
          path.join(staging, "intro.txt"),
          target.replace(/\.wav$/, ".txt"),
        );
      } finally {
        await fs.rm(staging, { recursive: true, force: true });
      }
    }
    await assembleReadingVerses(sources, part, verses, m.config.ffmpegBin);
  } else if (part.startsWith("chapter-")) {
    const chapter = chapterIntroductions.find((item) => item.part === part);
    if (!chapter) throw new Error("Invalid chapter introduction");
    const staging = await fs.mkdtemp(path.join(sources, ".chapter-voice-"));
    try {
      await longVoice.generateVoice(
        staging,
        {
          ...context,
          scriptOverrides: {
            intro:
              input.settings.voiceScriptOverrides?.[part] ?? chapter.script,
          },
        },
        true,
        "intro",
        (progress) => update(10 + progress * 0.85),
      );
      if (
        chapter.complete &&
        (
          input.settings.voiceScriptOverrides?.[part] ?? chapter.script
        ).trim() === chapter.script.trim()
      ) {
        await chapterVoiceCache.publish(
          path.join(staging, "intro.wav"),
          path.join(staging, "intro.txt"),
          {
            chapter: chapter.chapter,
            synthesis: chapterSynthesis(
              input.version.locale,
              input.voiceModel,
              input.voiceParameters,
              selectedRoleVoice(input.settings, input.version.locale, "intro"),
              input.voiceDecoder,
            ),
            complete: true,
            locale: input.version.locale,
          },
        );
        for (const extension of ["wav", "txt"])
          await fs.rm(path.join(sources, voiceFilename(part, extension)), {
            force: true,
          });
      } else {
        for (const extension of ["wav", "txt"])
          await fs.rename(
            path.join(staging, `intro.${extension}`),
            path.join(sources, voiceFilename(part, extension)),
          );
      }
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  } else {
    await generateNamedVoice(
      sources,
      m.voice,
      context,
      part as "intro" | "outro",
      {
        language: input.version.locale,
        ffmpeg: m.config.ffmpegBin,
        duration: m.passages.audioDurationSeconds,
      },
      (progress) => update(10 + progress * 0.85),
    );
  }
  update(99);
}

/** Resolve chapter recordings from the saved passage, without analyzing reading audio. */
export async function projectChapterVoiceFiles(
  input: Pick<
    RenderRequest,
    | "kind"
    | "version"
    | "passage"
    | "outputEnvironment"
    | "voiceModel"
    | "voiceDecoder"
    | "voiceParameters"
  > & {
    settings?: {
      baseVoice?: string;
      baseVoices?: { intro: string; outro: string; reading: string };
    };
  },
) {
  if (input.kind === "short") return [];
  const version = longConfig.versions.find(
    (item) =>
      item.id === input.version.id && item.locale === input.version.locale,
  );
  if (!version) throw new Error("Invalid Bible version");
  const index = await long.readIndex(version);
  const directory = sourceDir(
    input.kind,
    version.id,
    input.passage.id,
    input.outputEnvironment,
  );
  return Promise.all(
    long
      .passageChapters(index, input.passage)
      .map(async (range, chapterIndex) => {
        const part = `chapter-${chapterIndex}` as const;
        const identity = {
          chapter: range.chapter,
          synthesis: chapterSynthesis(
            version.locale,
            input.voiceModel,
            input.voiceParameters,
            selectedRoleVoice(
              input.settings ?? {},
              input.version.locale,
              "intro",
            ),
            input.voiceDecoder,
          ),
          locale: version.locale,
          complete:
            range.first === 1 &&
            range.last === range.book.versesPerChapter[range.chapter - 1],
        };
        if (identity.complete) {
          const savedScript = await fs
            .readFile(path.join(directory, voiceFilename(part, "txt")), "utf8")
            .catch((error) => {
              if (error.code === "ENOENT") return null;
              throw error;
            });
          const standard = chapterIntroductionText(
            version.locale,
            {
              ...range,
              total: range.book.versesPerChapter[range.chapter - 1],
            },
            (n) => longVoice.numberToWords(version.locale, n),
          ).script;
          // Custom chapter narration belongs to this project, never the shared cache.
          if (savedScript !== null && savedScript.trim() !== standard.trim())
            identity.complete = false;
        }
        return {
          part,
          ...(await chapterVoiceCache.resolve(
            path.join(directory, voiceFilename(part)),
            identity,
          )),
        };
      }),
  );
}

/** A shared complete-chapter voice is ready even before this project's directory exists. */
export async function chapterVoicesAvailable(
  input: Pick<
    RenderRequest,
    | "kind"
    | "version"
    | "passage"
    | "outputEnvironment"
    | "voiceModel"
    | "voiceDecoder"
    | "voiceParameters"
  >,
) {
  return (await projectChapterVoiceFiles(input)).every(
    (chapter) => chapter.available,
  );
}

/** Final renders only consume narration explicitly generated beforehand. */
export async function existingProjectVoices(
  input: Pick<
    RenderRequest,
    | "kind"
    | "version"
    | "passage"
    | "outputEnvironment"
    | "voiceModel"
    | "voiceDecoder"
    | "voiceParameters"
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
  const {
    data,
    sections,
    cues,
    context,
    version,
    m,
    chapterIntroductions,
    episodeContent,
  } = await analyze(input);
  const { output, sources } = await prepareProjectDirectories(input);
  const chapterFiles = await projectChapterVoiceFiles(input);
  if (chapterFiles.some((chapter) => !chapter.available))
    throw new Error(
      "Generate every chapter introduction before generating the video.",
    );
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
            episodeContent!.display,
            data.index.metadata.name,
            input.passage.episode,
            input.kind === "book",
          );
    const renderer =
      input.kind === "short"
        ? shortVideo.renderShortVideo
        : longVideo.renderEpisodeVideo;
    const trimmedVoices = {
      ...voices,
      intro: await prepareTrimmedVoice(
        voices.intro,
        input.settings.voiceTrims?.intro,
        work,
        "intro",
        m.config,
      ),
      outro: await prepareTrimmedVoice(
        voices.outro,
        input.settings.voiceTrims?.outro,
        work,
        "outro",
        m.config,
      ),
    };
    const trimmedChapters = await Promise.all(
      chapterIntroductions.map(async (chapter) => ({
        ...chapter,
        file: await prepareTrimmedVoice(
          chapterFiles.find((file) => file.part === chapter.part)!.file,
          input.settings.voiceTrims?.[chapter.part],
          work,
          chapter.part,
          m.config,
        ),
      })),
    );
    const final = path.join(work, "video.mp4");
    const result = await renderer(
      final,
      sections,
      m.config.videosDir,
      title,
      await m.outro(version.locale, input.socialAccounts, input.website),
      cues,
      trimmedVoices,
      work,
      input.settings.volumeMultiplier,
      {
        bibleVersionTitle: input.version.label,
        background: input.settings.background,
        chapterIntroductions: trimmedChapters,
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
    const descriptions = m.descriptions(
      version.locale,
      title,
      data.lines,
      input.publicationTemplates,
      publicationPassageUrl(input),
    );
    const thumbnailName = thumbnailFilename(descriptions);
    // Remove obsolete generated files when headings or platform templates change.
    for (const name of await fs.readdir(output)) {
      if (
        isPublicationFilename(name) ||
        isNumberedThumbnailFilename(name) ||
        name === "0-thumbnail.jpg"
      )
        await fs.rm(path.join(output, name), { force: true });
    }
    await fs.rename(final, path.join(output, videoFilename(input.kind)));
    await fs.rename(
      path.join(work, "thumbnail.jpg"),
      path.join(output, thumbnailName),
    );
    for (const platform of Object.keys(publicationFilenames))
      await fs.rm(path.join(output, `${platform}.txt`), { force: true });
    for (const name of [videoFilename(input.kind).slice(2), "thumbnail.jpg"])
      await fs.rm(path.join(output, name), { force: true });
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
        `Thumbnail: ../${thumbnailName} (frame at ${result.thumbnailTime.toFixed(6)} s)`,
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
      thumbnail: path.join(output, thumbnailName),
      descriptions,
      voiceScripts: scripts,
      sources: [
        ...sections.map((s) => s.file),
        path.join(m.config.videosDir, "0-intro.mp4"),
        path.join(m.config.videosDir, result.background),
        path.join(m.config.videosDir, "0-outro.mp4"),
        ...chapterFiles.map((chapter) => chapter.file),
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
