import { prepareTrimmedVoice } from "./voice-trim.js";
import type { VoicePart } from "./chapter-introductions.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  analyze,
  sourceDir,
  voiceFilename,
  projectChapterVoiceFiles,
} from "./pipeline.js";
import { prepareVideoComposition as shortComposition } from "./engines/short/video.js";
import { prepareVideoComposition as longComposition } from "./engines/long/video.js";
import { introTitle as shortIntro } from "./engines/short/shorts.js";
import { introTitle as longIntro } from "./engines/long/episodes.js";
import type { RenderRequest } from "./protocol.js";

type Scope = Pick<RenderRequest, "projectId" | "kind" | "outputEnvironment"> & {
  version: string;
  passage: string;
};
type Preview = {
  scope: Scope;
  files: string[];
  cleanup: () => Promise<void>;
  timer: ReturnType<typeof setTimeout>;
};
const previews = new Map<string, Preview>();
async function remove(id: string) {
  const preview = previews.get(id);
  if (!preview) return;
  previews.delete(id);
  clearTimeout(preview.timer);
  await preview.cleanup();
}

/** Prepare composition assets without generating voices or rendering final video frames. */
export async function createPreview(
  input: RenderRequest & {
    readingReferences?: string[];
    voicePart?: VoicePart;
  },
) {
  const {
    data,
    sections,
    cues: allCues,
    version,
    m,
    chapterIntroductions,
    episodeContent,
  } = await analyze(input);
  const chapterOnly = input.voicePart?.startsWith("chapter-");
  const readingOnly = Boolean(input.readingReferences) || Boolean(chapterOnly);
  const selectedChapter = chapterIntroductions.find(
    (chapter) => chapter.part === input.voicePart,
  );
  if (chapterOnly && !selectedChapter)
    throw new Error("Invalid chapter introduction");
  const references = new Set(
    selectedChapter?.references ?? input.readingReferences,
  );
  const cues = readingOnly
    ? allCues.filter((cue) => references.has(cue.reference))
    : allCues;
  if (readingOnly && (!cues.length || cues.length !== references.size))
    throw new Error("The selected passage is unavailable");
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "veobible-preview-"),
  );
  try {
    const voices = sourceDir(
      input.kind,
      version.id,
      input.passage.id,
      input.outputEnvironment,
    );
    const title =
      input.kind === "short"
        ? shortIntro(version.locale, data.label, data.index.metadata.name)
        : longIntro(
            version.locale,
            episodeContent!.display,
            data.index.metadata.name,
            input.passage.episode,
          );
    const chapterFiles =
      input.kind === "long" &&
      !input.readingReferences &&
      !(input.voicePart === "intro" || input.voicePart === "outro")
        ? await projectChapterVoiceFiles(input)
        : [];
    const narration = readingOnly
      ? undefined
      : {
          intro: await prepareTrimmedVoice(
            path.join(voices, voiceFilename("intro")),
            input.voicePart === "outro"
              ? undefined
              : input.settings.voiceTrims?.intro,
            directory,
            "intro",
            m.config,
          ),
          outro: await prepareTrimmedVoice(
            path.join(voices, voiceFilename("outro")),
            input.voicePart === "intro"
              ? undefined
              : input.settings.voiceTrims?.outro,
            directory,
            "outro",
            m.config,
          ),
          mode: "voice" as const,
        };
    const trimmedChapters = await Promise.all(
      (selectedChapter ? [selectedChapter] : chapterIntroductions)
        .filter((chapter) =>
          chapterFiles.some((file) => file.part === chapter.part),
        )
        .map(async (chapter) => ({
          ...chapter,
          file: await prepareTrimmedVoice(
            chapterFiles.find((file) => file.part === chapter.part)!.file,
            input.settings.voiceTrims?.[chapter.part],
            directory,
            chapter.part,
            m.config,
          ),
        })),
    );
    const prepare = input.kind === "short" ? shortComposition : longComposition;
    // Keep the prepared reading audio at its original volume so the Player can adjust it live.
    const composition = await prepare(
      sections,
      m.config.videosDir,
      title,
      await m.outro(version.locale, input.socialAccounts),
      cues,
      narration,
      directory,
      1,
      {
        bibleVersionTitle: input.version.label,
        background: input.settings.background,
        readingOnly,
        previewVoicePart:
          input.voicePart === "intro" || input.voicePart === "outro"
            ? input.voicePart
            : undefined,
        chapterIntroductions: trimmedChapters,
      },
    );
    if (chapterOnly && composition.props.chapterIntroductions?.length) {
      const chapter = composition.props.chapterIntroductions[0];
      composition.props.chapterIntroductions = [{ ...chapter, start: 0 }];
      composition.props.sections = [];
      composition.props.verseCues = [];
      composition.props.readingLength =
        chapter.duration + 1 + composition.props.readingSilence;
    }
    const id = randomUUID();
    const files: string[] = [];
    const asset = (file: string) => {
      let index = files.indexOf(file);
      if (index < 0) index = files.push(file) - 1;
      return `preview-${id}-${index}`;
    };
    const props = {
      ...composition.props,
      volumeMultiplier: input.settings.volumeMultiplier,
      introVideoPath: asset(composition.props.introVideoPath),
      boomerangVideoPath: asset(composition.props.boomerangVideoPath),
      outroVideoPath: asset(composition.props.outroVideoPath),
      chapterIntroductions: composition.props.chapterIntroductions?.map(
        (chapter) => ({ ...chapter, file: asset(chapter.file) }),
      ),
      sections: composition.props.sections.map((section) => ({
        ...section,
        file: asset(section.file),
      })),
      voices: composition.props.voices
        ? {
            ...composition.props.voices!,
            intro: asset(composition.props.voices!.intro),
            outro: asset(composition.props.voices!.outro),
          }
        : undefined,
    };
    const timer = setTimeout(
      () => {
        void remove(id).catch(console.error);
      },
      24 * 60 * 60 * 1000,
    );
    timer.unref();
    previews.set(id, {
      scope: {
        projectId: input.projectId,
        kind: input.kind,
        outputEnvironment: input.outputEnvironment,
        version: version.id,
        passage: input.passage.id,
      },
      files,
      cleanup: () => fs.rm(directory, { recursive: true, force: true }),
      timer,
    });
    while (previews.size > 20) await remove(previews.keys().next().value!);
    return {
      props,
      background: composition.background,
      fps: composition.fps,
      width: composition.width,
      height: composition.height,
      durationInFrames: chapterOnly
        ? Math.round(composition.props.readingLength * composition.fps)
        : input.voicePart
          ? Math.round(
              (input.voicePart === "intro"
                ? composition.props.introLength
                : composition.props.outroLength) * composition.fps,
            )
          : readingOnly
            ? Math.round(composition.props.readingLength * composition.fps)
            : composition.totalFrames,
    };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Resolve only server-owned assets belonging to the authenticated project and environment. */
export function previewAsset(asset: string, scope: Scope) {
  const match = /^preview-([0-9a-f-]{36})-(\d+)$/.exec(asset);
  if (!match) return undefined;
  const preview = previews.get(match[1]);
  if (
    !preview ||
    Object.keys(scope).some(
      (key) => scope[key as keyof Scope] !== preview.scope[key as keyof Scope],
    )
  )
    return undefined;
  return preview.files[Number(match[2])];
}
