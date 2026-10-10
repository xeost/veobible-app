import {
  videoFilename,
  thumbnailFilename,
  publicationFilenames,
  isPublicationFilename,
  isNumberedThumbnailFilename,
} from "./output-files.js";
import fs from "node:fs/promises";
import path from "node:path";
import { availableBibleVersions } from "./bible-versions.js";
import {
  projectProposalsSchema,
  loadProjectProposals,
} from "./project-proposals.js";
import { renderSchema, settingsSchema } from "./protocol.js";
import { z } from "zod";

const identifier = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const localeSchema = renderSchema.shape.version.shape.locale;
type Version = { locale: "es" | "en" | "pt"; code: string; label: string };
type ExistingProject = {
  slug: string;
  version: Version;
  title: string;
  passage: z.infer<typeof renderSchema.shape.passage>;
  settings: Partial<z.infer<typeof settingsSchema>>;
  published: boolean;
};

async function optionalText(files: string[]) {
  for (const file of files) {
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error("Invalid project file");
      return await fs.readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return undefined;
}
const internalFiles = (
  directory: string,
  current: string,
  legacy: string,
  alias?: string,
) => [
  path.join(directory, "_internal", current),
  ...(alias ? [path.join(directory, "_internal", alias)] : []),
  path.join(directory, "internal", legacy),
  path.join(directory, legacy),
];
const metadataField = (text: string, label: string) =>
  text
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${label}: `))
    ?.slice(label.length + 2)
    .trim();

export async function discoverExistingProjects(
  kind: "short" | "long",
  options: {
    directory?: string;
    versions?: Version[];
    bibleRoot?: string;
    outputEnvironment?: "production" | "development";
  } = {},
) {
  const directory =
    options.directory ??
    (await import("./working-directories.js")).workingDirectory(kind);
  const output = path.join(
    directory,
    options.outputEnvironment === "development" ? "outputs-dev" : "outputs",
  );
  const versions = options.versions ?? (await availableBibleVersions());
  const statusText = await optionalText([path.join(output, "status.json")]);
  const status = z
    .record(
      z.object({
        locale: localeSchema,
        version: renderSchema.shape.version.shape.id,
        usedAt: z.string().min(1),
        output: z.string().min(1),
      }),
    )
    .parse(statusText === undefined ? {} : JSON.parse(statusText));
  const publication = new Set<string>();
  for (const [key, record] of Object.entries(status)) {
    const parts = key.split("/");
    const slug =
      parts.length === 1
        ? key
        : parts.length === 3 &&
            parts[0] === record.locale &&
            parts[1] === record.version
          ? parts[2]
          : undefined;
    if (!slug || !identifier.test(slug))
      throw new Error("Invalid publication record");
    publication.add(`${record.locale}/${record.version}/${slug}`);
  }
  const presetsText = await optionalText([
    path.join(directory, "material", "video-project-presets.json"),
  ]);
  const presets =
    presetsText === undefined
      ? []
      : projectProposalsSchema.parse(JSON.parse(presetsText));
  const projects: ExistingProject[] = [];
  let skipped = 0;
  const versionDirs = await fs
    .readdir(output, { withFileTypes: true })
    .catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
  for (const versionDir of versionDirs) {
    if (!versionDir.isDirectory() || !identifier.test(versionDir.name))
      continue;
    const entries = await fs.readdir(path.join(output, versionDir.name), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || !identifier.test(entry.name)) continue;
      try {
        const project = path.join(output, versionDir.name, entry.name);
        const metadata =
          (await optionalText(
            internalFiles(project, "0-metadata.txt", "metadata.txt"),
          )) ?? "";
        const recordedLocale = metadataField(metadata, "Idioma");
        const candidates = versions.filter(
          (version) =>
            version.code === versionDir.name &&
            (!recordedLocale || version.locale === recordedLocale),
        );
        if (candidates.length !== 1)
          throw new Error("Missing or ambiguous Bible version");
        const version = candidates[0];
        const recordedSlug = metadataField(metadata, "ID del pasaje");
        if (recordedSlug && recordedSlug !== entry.name)
          throw new Error("Project identifier mismatch");
        const preset = presets.find((row) => row.slug === entry.name);
        let passage: ExistingProject["passage"];
        let title = metadataField(metadata, "Referencia");
        if (preset) {
          passage = {
            id: preset.slug,
            book: preset.start.book,
            endBook: preset.end.book,
            ...(kind === "long" ? { episode: preset.id } : {}),
            start: { chapter: preset.start.chapter, verse: preset.start.verse },
            end: { chapter: preset.end.chapter, verse: preset.end.verse },
          };
          if (!title)
            title = (
              await loadProjectProposals(
                kind,
                version,
                directory,
                options.bibleRoot,
              )
            ).find((row) => row.slug === preset.slug)?.title;
        } else {
          const book = /\(([a-z0-9-]+)\)$/.exec(
            metadataField(metadata, "Libro") ?? "",
          )?.[1];
          const start = /^(\d+):(\d+)$/.exec(
            metadataField(metadata, "Inicio") ?? "",
          );
          const end = /^(\d+):(\d+)$/.exec(
            metadataField(metadata, "Fin") ?? "",
          );
          if (!book || !start || !end || kind === "long")
            throw new Error("Passage boundaries unavailable");
          passage = {
            id: entry.name,
            book,
            endBook: book,
            start: { chapter: Number(start[1]), verse: Number(start[2]) },
            end: { chapter: Number(end[1]), verse: Number(end[2]) },
          };
        }
        passage = renderSchema.shape.passage.parse(passage);
        const settings: ExistingProject["settings"] = {};
        const audio = await optionalText(
          internalFiles(
            project,
            "2-passage-audio-offsets.json",
            "offsets.json",
            "2-offsets.json",
          ),
        );
        if (audio !== undefined)
          settings.passageOffsets = settingsSchema.shape.passageOffsets.parse(
            JSON.parse(audio),
          );
        const verses = await optionalText(
          internalFiles(
            project,
            "2-verse-text-offsets.json",
            "verse-offsets.json",
            "2-verse-offsets.json",
          ),
        );
        if (verses !== undefined) {
          settings.verseOffsets = settingsSchema.shape.verseOffsets.parse(
            z.object({ verses: z.unknown() }).parse(JSON.parse(verses)).verses,
          );
          if (
            new Set(settings.verseOffsets.map((row) => row.reference)).size !==
            settings.verseOffsets.length
          )
            throw new Error("Duplicate verse offsets");
        }
        const reading = await optionalText(
          internalFiles(
            project,
            "2-passage-audio-settings.json",
            "reading-audio.json",
          ),
        );
        if (reading !== undefined)
          settings.volumeMultiplier = z
            .object({
              volumeMultiplier:
                settingsSchema.shape.volumeMultiplier.removeDefault(),
            })
            .parse(JSON.parse(reading)).volumeMultiplier;
        else {
          const recordedVolume = metadataField(
            metadata,
            "Volumen de la lectura",
          );
          const defaults = recordedVolume
            ? undefined
            : await optionalText([
                path.join(
                  output,
                  versionDir.name,
                  "default-version-settings.json",
                ),
              ]);
          if (recordedVolume)
            settings.volumeMultiplier = settingsSchema.shape.volumeMultiplier
              .removeDefault()
              .parse(Number(recordedVolume.replace(/x$/, "")));
          else if (defaults !== undefined)
            settings.volumeMultiplier = z
              .object({
                volumeMultiplier:
                  settingsSchema.shape.volumeMultiplier.removeDefault(),
              })
              .parse(JSON.parse(defaults)).volumeMultiplier;
        }
        const background = /(?:^|, )([a-zA-Z0-9_.-]+\.mp4) \(boomerang/.exec(
          metadataField(metadata, "Vídeos") ?? "",
        )?.[1];
        if (background) settings.background = background;
        if (
          kind === "long" &&
          passage.episode &&
          metadataField(metadata, "Referencia")
        )
          title = `${{ es: "Día", en: "Day", pt: "Dia" }[version.locale]} ${String(passage.episode).padStart(3, "0")} · ${title}`;
        projects.push({
          slug: entry.name,
          version,
          title: title ?? entry.name,
          passage,
          settings,
          published: publication.has(
            `${version.locale}/${version.code}/${entry.name}`,
          ),
        });
      } catch (error) {
        skipped++;
        console.warn(
          `Skipping existing project ${kind}/${versionDir.name}/${entry.name}`,
          error,
        );
      }
    }
  }
  return { projects, skipped };
}

/** Prefer numbered media while keeping previously generated projects playable. */
export async function existingOutputMedia(
  directory: string,
  kind: "short" | "long",
  asset: "video" | "thumbnail",
) {
  const filename = videoFilename(kind);
  const candidates = asset === "video"
    ? [filename, filename.slice(2)]
    : [
        ...(await fs.readdir(directory).catch((error) => {
          if (error.code === "ENOENT") return [];
          throw error;
        })).filter(isNumberedThumbnailFilename).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
        "0-thumbnail.jpg", "thumbnail.jpg",
      ];
  for (const name of candidates) {
    const file = path.join(directory, name);
    if ((await fs.stat(file).catch(() => null))?.isFile()) return file;
  }
  return null;
}

/** Read final media directly; older outputs do not have a dashboard render manifest. */
export async function existingRenderResult(
  directory: string,
  kind: "short" | "long",
) {
  const video = await existingOutputMedia(directory, kind, "video");
  if (!video) return null;
  const descriptions: Record<string, string> = {};
  for (const [platform, filename] of Object.entries(publicationFilenames)) {
    const content = await optionalText([
      path.join(directory, filename),
      path.join(directory, `${platform}.txt`),
    ]);
    if (content !== undefined) descriptions[filename] = content;
  }
  for (const filename of (await fs.readdir(directory)).filter(isPublicationFilename)) {
    descriptions[filename] = await fs.readFile(path.join(directory, filename), "utf8");
  }
  return {
    video,
    thumbnail:
      (await existingOutputMedia(directory, kind, "thumbnail")) ??
      path.join(directory, thumbnailFilename(descriptions)),
    descriptions,
  };
}
