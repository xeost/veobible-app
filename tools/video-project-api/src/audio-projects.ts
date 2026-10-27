import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { adaptNarrationText } from "./narration-text-adaptations.js";
import {
  audioMixSettingsChanged,
  isAudioVerseApproved,
} from "./audio-approvals.js";
import { sharedAudioDirectory } from "./working-directories.js";
import { availableBibleBooks } from "./bible-versions.js";
import { readBibleDataFile } from "./bible-data.js";
import { generateVoice } from "./engines/long/voice.js";
import { config } from "./engines/long/config.js";
import {
  audioVersionSchema,
  audioEnvironmentSchema,
  audioEditionSchema,
  audioBookSchema,
  audioSaveSchema,
  audioGenerateSchema,
  audioTrimSchema,
  type AudioProject,
  type AudioProjectDetail,
  type AudioProjectSummary,
  type AudioVersion,
} from "./audio-project-schema.js";

export class AudioProjectError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
const execute = promisify(execFile);
const markerName = ".audio-edition.json";
const key = (edition: string, book: string) => `${edition}/${book}`;
function validatedAudioTrim(value: unknown, duration: number) {
  const aligned = audioTrimSchema.safeParse(value);
  if (!aligned.success || aligned.data.endSeconds > duration)
    throw new Error("Invalid generated audio alignment boundaries");
  return aligned.data;
}
const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === "ENOENT";
async function exists(file: string) {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
}
async function realDirectory(directory: string) {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new AudioProjectError("Audio folder is not available.");
}
async function safeFile(root: string, file: string) {
  if (
    !file ||
    path.isAbsolute(file) ||
    file.split(/[/\\]/).some((p) => p === ".." || p === ".")
  )
    throw new AudioProjectError("Invalid audio file.");
  let current = root;
  for (const part of file.split("/")) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink())
        throw new AudioProjectError("Linked audio files cannot be changed.");
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return current;
}
async function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value) + "\n", { flag: "wx" });
    await fs.rename(temporary, file);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}
export type AudioTask = { chapter: number; verse?: number };
export type AudioTaskReporter = (
  task: AudioTask,
  status: "running" | "done",
  progress: number,
) => void;
export function audioTasks(
  project: AudioProjectDetail,
  input: z.infer<typeof audioGenerateSchema>,
): AudioTask[] {
  const chapters = project.content.filter(
    (c) => !input.chapter || c.chapter === input.chapter,
  );
  return [
    ...chapters.flatMap((c) =>
      c.verses
        .filter(
          (v) =>
            !input.assembleOnly &&
            (!input.verse || input.verse === v.verse) &&
            (input.alignOnly
              ? Boolean(project.recordings[`${c.chapter}:${v.verse}`])
              : input.regenerate ||
                input.textOverride !== undefined ||
                !project.recordings[`${c.chapter}:${v.verse}`]),
        )
        .map((v) => ({ chapter: c.chapter, verse: v.verse })),
    ),
    ...(!input.verse && !input.voicesOnly && !input.alignOnly
      ? chapters.map((c) => ({ chapter: c.chapter }))
      : []),
  ];
}
export class AudioProjects {
  // Only transient worker snapshots live here. The dashboard database owns
  // project persistence; disk contains recordings and ownership receipts only.
  private cache = new Map<string, AudioProject>();
  private reporters = new Map<
    string,
    (project: AudioProject) => Promise<void>
  >();
  private pending = new Set<string>();
  private generationScopes = new Map<
    string,
    Map<string, { chapter?: number; verse?: number }>
  >();
  private closing = new Set<string>();
  public root: string;
  constructor(
    root = sharedAudioDirectory,
    public environment: AudioProject["outputEnvironment"] = "production",
  ) {
    this.root = environment === "development" ? path.join(root, "dev") : root;
  }
  hydrate(project: AudioProject) {
    if (project.outputEnvironment !== this.environment)
      throw new AudioProjectError(
        "Audio project does not match its folder.",
        400,
      );
    const id = key(project.edition, project.book);
    if (!this.pending.has(id)) this.cache.set(id, structuredClone(project));
  }
  async nextEdition(code: string) {
    audioVersionSchema.shape.code.parse(code);
    await fs.mkdir(this.root, { recursive: true });
    await realDirectory(this.root);
    // The unsuffixed directory is reserved for human recordings, even when absent.
    // Generated editions always start at v2; never infer v1 from missing originals.
    let next = 2;
    for (const name of await fs.readdir(this.root)) {
      if (!name.startsWith(`${code}-v`)) continue;
      const suffix = name.slice(code.length + 2).replace(/_internal$/, "");
      if (/^[1-9]\d*$/.test(suffix)) next = Math.max(next, Number(suffix) + 1);
    }
    if (!Number.isSafeInteger(next))
      throw new AudioProjectError("No new audio version is available.");
    return { number: next, edition: `${code}-v${next}` };
  }
  async owned(edition: string) {
    audioEditionSchema.parse(edition);
    await realDirectory(this.root);
    const output = path.join(this.root, edition),
      internal = path.join(this.root, `${edition}_internal`);
    await realDirectory(output);
    await realDirectory(internal);
    const marker = z
      .object({
        owner: z.string().uuid(),
        outputEnvironment: audioEnvironmentSchema.default("production"),
        edition: audioEditionSchema,
        version: audioVersionSchema,
      })
      .parse(
        JSON.parse(
          await fs.readFile(await safeFile(output, markerName), "utf8"),
        ),
      );
    const twin = JSON.parse(
      await fs.readFile(await safeFile(internal, markerName), "utf8"),
    );
    if (
      marker.outputEnvironment !== this.environment ||
      marker.edition !== edition ||
      twin.owner !== marker.owner ||
      twin.edition !== edition
    )
      throw new AudioProjectError(
        "This audio folder belongs to another project.",
      );
    return { output, internal, marker };
  }
  async create(versionValue: unknown, expectedEdition: string) {
    const version = audioVersionSchema.parse(versionValue);
    const books = await availableBibleBooks(version.locale, version.code);
    const next = await this.nextEdition(version.code);
    if (next.edition !== expectedEdition)
      throw new AudioProjectError(
        "The next audio version changed. Reload the list and try again.",
      );
    const output = path.join(this.root, next.edition),
      internal = path.join(this.root, `${next.edition}_internal`);
    // Never reuse, remove, or recursively create an edition folder. mkdir is the
    // atomic reservation, including when two requests choose the same number.
    try {
      await fs.mkdir(output);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new AudioProjectError(
          "The next audio version changed. Reload the list and try again.",
        );
      throw error;
    }
    await fs.mkdir(internal);
    const marker = {
      owner: randomUUID(),
      edition: next.edition,
      version,
      outputEnvironment: this.environment,
    };
    for (const directory of [output, internal])
      await fs.writeFile(
        path.join(directory, markerName),
        JSON.stringify(marker),
        { flag: "wx" },
      );
    const projects: AudioProject[] = [];
    for (const [index, book] of books.entries()) {
      audioBookSchema.parse(book.id);
      const project: AudioProject = {
        outputEnvironment: this.environment,
        edition: next.edition,
        version,
        book: book.id,
        title: book.name,
        order: index + 1,
        chapterCount: book.chapters,
        verseCounts: book.versesPerChapter,
        settings: {
          baseVoice: `${version.locale}-1`,
          inheritBaseVoice: true,
          voiceDefaultsVersion: 1,
          trims: {},
          pauses: {},
        },
        revision: 0,
        recordings: {},
        chapters: {},
        status: "draft",
        progress: 0,
        updatedAt: new Date().toISOString(),
      };
      this.hydrate(project);
      projects.push(project);
    }
    return { ...next, count: books.length, projects };
  }
  async read(edition: string, book: string): Promise<AudioProject> {
    audioBookSchema.parse(book);
    const { marker } = await this.owned(edition);
    const project = structuredClone(this.cache.get(key(edition, book)));
    if (!project) throw new AudioProjectError("Audio project not found.", 404);
    if (
      project.edition !== edition ||
      project.book !== book ||
      project.version.code !== marker.version.code ||
      project.version.locale !== marker.version.locale
    )
      throw new AudioProjectError("Audio project does not match its folder.");
    if (
      ["queued", "running"].includes(project.status) &&
      !this.pending.has(key(edition, book))
    ) {
      project.status = "failed";
      await this.write(project);
    }
    return project;
  }
  private async write(project: AudioProject) {
    await this.owned(project.edition);
    project.updatedAt = new Date().toISOString();
    this.cache.set(
      key(project.edition, project.book),
      structuredClone(project),
    );
    await this.reporters.get(key(project.edition, project.book))?.(
      structuredClone(project),
    );
  }
  async list() {
    const projects: AudioProjectSummary[] = [];
    for (const item of this.cache.values()) {
      const {
        recordings: _,
        settings: _settings,
        revision: _revision,
        ...summary
      } = await this.read(item.edition, item.book);
      projects.push(summary);
    }
    return projects.sort(
      (a, b) =>
        a.version.label.localeCompare(b.version.label) ||
        a.edition.localeCompare(b.edition, undefined, { numeric: true }) ||
        a.order - b.order,
    );
  }
  async detail(edition: string, book: string): Promise<AudioProjectDetail> {
    const project = await this.read(edition, book);
    return { ...project, content: await this.content(project) };
  }
  async content(
    project: Pick<
      AudioProject,
      "edition" | "book" | "version" | "chapterCount"
    >,
  ) {
    const { marker } = await this.owned(project.edition);
    if (
      marker.version.code !== project.version.code ||
      marker.version.locale !== project.version.locale
    )
      throw new AudioProjectError("Audio project does not match its folder.");
    const book = audioBookSchema.parse(project.book);
    const content: AudioProjectDetail["content"] = [];
    for (let chapter = 1; chapter <= project.chapterCount; chapter++) {
      const verses = z
        .array(
          z.object({
            verse: z.number().int().positive(),
            text: z.string().min(1),
          }),
        )
        .min(1)
        .parse(
          JSON.parse(
            await readBibleDataFile(
              path.join(
                project.version.locale,
                project.version.code,
                book,
                `${chapter}.json`,
              ),
            ),
          ),
        );
      content.push({ chapter, verses });
    }
    return content;
  }
  async save(edition: string, book: string, value: unknown) {
    const input = audioSaveSchema.parse(value);
    if (this.pending.has(key(edition, book)))
      throw new AudioProjectError("Wait for audio generation to finish.");
    // Serialize read/check/write across concurrent requests, including saves.
    this.pending.add(key(edition, book));
    try {
      const project = await this.detail(edition, book);
      if (input.revision !== project.revision)
        throw new AudioProjectError(
          "This audio project changed. Reload it before saving.",
        );
      if (!input.settings.baseVoice.startsWith(`${project.version.locale}-`))
        throw new AudioProjectError(
          "Choose a voice in the project's language.",
          400,
        );
      const refs = new Set(
        project.content.flatMap((c) =>
          c.verses.map((v) => `${c.chapter}:${v.verse}`),
        ),
      );
      for (const ref of [
        ...Object.keys(input.settings.trims),
        ...Object.keys(input.settings.pauses),
        ...Object.keys(input.settings.approvals ?? {}),
      ])
        if (!refs.has(ref))
          throw new AudioProjectError("Verse not found.", 400);
      for (const [ref, trim] of Object.entries(input.settings.trims))
        if (
          !project.recordings[ref] ||
          trim.endSeconds > project.recordings[ref].duration + 0.01
        )
          throw new AudioProjectError(
            "The audio trim is outside this verse.",
            400,
          );
      const { content: _, ...stored } = project;
      // Changed settings make the existing chapter mix stale until assembled again.
      if (audioMixSettingsChanged(stored.settings, input.settings)) {
        stored.status = "draft";
        stored.chapters = {};
      }
      stored.settings = input.settings;
      stored.revision++;
      await this.write(stored);
      return stored;
    } finally {
      this.pending.delete(key(edition, book));
    }
  }
  async media(edition: string, book: string, chapter: number, verse?: number) {
    const project = await this.read(edition, book);
    const { internal, output } = await this.owned(edition);
    const asset = verse
      ? project.recordings[`${chapter}:${verse}`]
      : project.chapters[String(chapter)];
    if (!asset) throw new AudioProjectError("Audio is not ready yet.", 404);
    return safeFile(verse ? internal : output, asset.file);
  }
  async cleanChapterEditingFiles(
    edition: string,
    book: string,
    chapter: number,
  ) {
    const id = key(edition, book);
    if (this.pending.has(id))
      throw new AudioProjectError("Wait for audio generation to finish.");
    this.pending.add(id);
    try {
      const project = await this.read(edition, book);
      if (
        !Number.isInteger(chapter) ||
        chapter < 1 ||
        chapter > project.chapterCount
      )
        throw new AudioProjectError("Verse not found.", 400);
      const { internal, output } = await this.owned(edition);
      const finalFile = project.chapters[String(chapter)]?.file;
      const finalStat = finalFile
        ? await fs.lstat(await safeFile(output, finalFile)).catch((error) => {
            if (missing(error)) return undefined;
            throw error;
          })
        : undefined;
      if (!finalStat?.isFile() || finalStat.size === 0)
        throw new AudioProjectError(
          "The final chapter audio is missing. Create it before cleaning editing files.",
        );
      const bookDirectory = await safeFile(internal, book);
      const entries = await fs
        .readdir(bookDirectory, { withFileTypes: true })
        .catch((error) => {
          if (missing(error)) return [];
          throw error;
        });
      const directories: string[] = [];
      const chapterDirectory = new RegExp(`^${chapter}-[1-9]\\d*-`);
      for (const entry of entries) {
        if (!chapterDirectory.test(entry.name)) continue;
        // Validate every target before deleting anything; never follow links.
        const directory = await safeFile(internal, `${book}/${entry.name}`);
        if (entry.isDirectory()) directories.push(directory);
      }
      for (const directory of directories)
        await fs.rm(directory, { recursive: true, force: true });
      for (let verse = 1; verse <= project.verseCounts[chapter - 1]; verse++) {
        const reference = `${chapter}:${verse}`;
        if (!isAudioVerseApproved(project, project.settings, reference))
          delete project.settings.approvals?.[reference];
        else project.settings.approvals![reference].editingFilesRemoved = true;
        delete project.recordings[reference];
        delete project.settings.trims[reference];
      }
      project.status =
        Object.keys(project.chapters).length === project.chapterCount
          ? "done"
          : "draft";
      project.progress = 100;
      project.revision++;
      await this.write(project);
      return project;
    } finally {
      this.pending.delete(id);
    }
  }
  /** Browser grants authorize audio within one book, without a hydrated DB snapshot. */
  async browserMediaScope(
    edition: string,
    book: string,
    order: number,
    chapterCount: number,
  ) {
    audioBookSchema.parse(book);
    const { marker } = await this.owned(edition);
    return { version: marker.version, book, order, chapterCount };
  }
  async browserMedia(edition: string, book: string, file: string) {
    audioBookSchema.parse(book);
    const { internal, output } = await this.owned(edition);
    const verse = file.startsWith(`${book}/`) && file.endsWith(".wav");
    if (!verse && !new RegExp(`^\\d{2}-${book}-[1-9]\\d*\\.mp3$`).test(file))
      throw new AudioProjectError("Invalid audio file.", 400);
    return safeFile(verse ? internal : output, file);
  }
  async queue(
    edition: string,
    book: string,
    value: unknown,
    enqueue: (run: () => Promise<void>, tasks: AudioTask[]) => void,
    dependencies: AudioGenerationDependencies = productionDependencies,
    reporter?: (project: AudioProject) => Promise<void>,
    taskReporter?: AudioTaskReporter,
    append = false,
  ) {
    const input = audioGenerateSchema.parse(value),
      id = key(edition, book);
    const scopes =
      this.generationScopes.get(id) ??
      new Map<string, { chapter?: number; verse?: number }>();
    if (
      this.closing.has(id) ||
      (append && !scopes.size) ||
      (this.pending.has(id) && (!append || !scopes.size))
    )
      throw new AudioProjectError("Wait for audio generation to finish.");
    if (
      [...scopes.values()].some(
        (scope) =>
          !scope.chapter ||
          !input.chapter ||
          (scope.chapter === input.chapter &&
            (!scope.verse || !input.verse || scope.verse === input.verse)),
      )
    )
      throw new AudioProjectError("Wait for audio generation to finish.");
    const requestId = randomUUID();
    const first = scopes.size === 0;
    scopes.set(requestId, { chapter: input.chapter, verse: input.verse });
    this.generationScopes.set(id, scopes);
    this.pending.add(id);
    if (first && reporter) this.reporters.set(id, reporter);
    const release = () => {
      scopes.delete(requestId);
      if (!scopes.size) {
        this.pending.delete(id);
        this.generationScopes.delete(id);
        this.reporters.delete(id);
        this.closing.delete(id);
      }
    };
    let project: AudioProjectDetail;
    try {
      project = await this.detail(edition, book);
      if (
        input.chapter &&
        !project.content.some(
          (c) =>
            c.chapter === input.chapter &&
            (!input.verse || c.verses.some((v) => v.verse === input.verse)),
        )
      )
        throw new AudioProjectError("Verse not found.", 400);
      if (
        input.assembleOnly &&
        project.content
          .filter((c) => !input.chapter || c.chapter === input.chapter)
          .some((c) =>
            c.verses.some(
              (v) => !project.recordings[`${c.chapter}:${v.verse}`],
            ),
          )
      )
        throw new AudioProjectError(
          "Generate all verse voices before creating final audio.",
        );
      if (first) {
        project.status = "queued";
        project.progress = 0;
        const { content: _, ...stored } = project;
        await this.write(stored);
      }
    } catch (error) {
      release();
      throw error;
    }
    enqueue(
      async () => {
        try {
          await this.generate(
            await this.detail(edition, book),
            input,
            dependencies,
            taskReporter,
          );
        } catch (error) {
          console.error("Audio generation failed", id, error);
          const current = await this.read(edition, book);
          current.status = scopes.size > 1 ? "running" : "failed";
          if (scopes.size === 1) this.closing.add(id);
          await this.write(current);
        } finally {
          release();
        }
      },
      audioTasks(project, input),
    );
    return { queued: true };
  }
  private async generate(
    detail: AudioProjectDetail,
    input: z.infer<typeof audioGenerateSchema>,
    dependencies: AudioGenerationDependencies,
    taskReporter?: AudioTaskReporter,
  ) {
    const { content, ...project } = detail;
    const { internal, output } = await this.owned(project.edition);
    const chapters = content.filter(
      (c) => !input.chapter || c.chapter === input.chapter,
    );
    const verses = (input.assembleOnly ? [] : chapters).flatMap((c) =>
      c.verses
        .filter(
          (v) =>
            (!input.verse || v.verse === input.verse) &&
            (!input.alignOnly ||
              Boolean(project.recordings[`${c.chapter}:${v.verse}`])),
        )
        .map((v) => ({ ...v, chapter: c.chapter })),
    );
    project.status = "running";
    await this.write(project);
    for (const [index, verse] of verses.entries()) {
      const ref = `${verse.chapter}:${verse.verse}`;
      const needsGeneration =
        !input.alignOnly &&
        (input.regenerate ||
          input.textOverride !== undefined ||
          !project.recordings[ref]);
      if (input.alignOnly) {
        const recording = project.recordings[ref];
        const task = { chapter: verse.chapter, verse: verse.verse };
        taskReporter?.(task, "running", 0);
        const trim = validatedAudioTrim(
          await dependencies.align(
            await safeFile(internal, recording.file),
            recording.duration,
            verse.text,
            project.version.locale,
            (progress) =>
              taskReporter?.(task, "running", Math.min(99, progress)),
          ),
          recording.duration,
        );
        project.settings.trims[ref] = trim;
        delete project.chapters[String(verse.chapter)];
      }
      let generatedDirectory: string | undefined;
      if (needsGeneration) {
        const speechText = input.textOverride ?? verse.text;
        const revision = randomUUID();
        const relative = `${project.book}/${verse.chapter}-${verse.verse}-${revision}`;
        const directory = await safeFile(internal, relative);
        await fs.mkdir(directory, { recursive: true });
        try {
          const task = { chapter: verse.chapter, verse: verse.verse };
          taskReporter?.(task, "running", 0);
          await dependencies.synthesize(
            directory,
            speechText,
            project,
            input,
            (progress) =>
              taskReporter?.(task, "running", Math.min(70, progress * 0.7)),
          );
          const wav = path.join(directory, "verse.wav");
          const duration = await dependencies.duration(wav);
          if (!Number.isFinite(duration) || duration <= 0.02)
            throw new Error("Invalid generated audio duration");
          // Publish the new recording only once its exact transcript is aligned.
          // A failed regeneration must preserve the previous recording and trim.
          const trim = validatedAudioTrim(
            await dependencies.align(
              wav,
              duration,
              adaptNarrationText(
                speechText,
                project.version.locale,
                input.voiceTextAdaptations,
              ),
              project.version.locale,
              (progress) =>
                taskReporter?.(
                  task,
                  "running",
                  Math.min(99, 70 + progress * 0.3),
                ),
            ),
            duration,
          );
          await fs.writeFile(
            path.join(directory, "verse.txt"),
            verse.text.trim() + "\n",
          );
          project.recordings[ref] = {
            file: `${relative}/verse.wav`,
            duration,
            revision,
            synthesis: {
              model: input.voiceModel,
              decoder:
                input.voiceDecoder ??
                (input.voiceModel === "latam"
                  ? "general"
                  : input.voiceModel === "pt-br"
                    ? "v3"
                    : undefined),
              parameters: input.voiceParameters,
            },
          };
          project.settings.trims[ref] = trim;
          delete project.chapters[String(verse.chapter)];
          generatedDirectory = relative;
        } catch (error) {
          await fs.rm(directory, { recursive: true, force: true });
          throw error;
        }
      }
      project.progress = Math.round(
        ((index + 1) / verses.length) *
          (input.verse || input.voicesOnly || input.alignOnly ? 100 : 85),
      );
      project.revision++;
      await this.write(project);
      if (generatedDirectory) {
        // Persist the replacement before removing earlier revisions, including
        // folders left behind by older workers or interrupted attempts.
        const bookDirectory = await safeFile(internal, project.book);
        const prefix = `${verse.chapter}-${verse.verse}-`;
        for (const entry of await fs.readdir(bookDirectory, {
          withFileTypes: true,
        })) {
          if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
          const relative = `${project.book}/${entry.name}`;
          if (relative === generatedDirectory) continue;
          await fs.rm(await safeFile(internal, relative), {
            recursive: true,
            force: true,
          });
        }
      }
      if (needsGeneration || input.alignOnly)
        taskReporter?.(
          { chapter: verse.chapter, verse: verse.verse },
          "done",
          100,
        );
    }
    if (!input.verse && !input.voicesOnly && !input.alignOnly) {
      for (const [index, chapter] of chapters.entries()) {
        taskReporter?.({ chapter: chapter.chapter }, "running", 0);
        const filename = `${String(project.order).padStart(2, "0")}-${project.book}-${chapter.chapter}.mp3`;
        // A chapter belongs only to this book. Refuse unexpected files even in
        // an owned edition; no overwriting imported or manually added audio.
        const destination = await safeFile(output, filename);
        const receipt = await safeFile(
          internal,
          `${project.book}-${chapter.chapter}.receipt.json`,
        );
        if (await exists(destination)) {
          const owner = await fs
            .readFile(receipt, "utf8")
            .then(JSON.parse)
            .catch(() => null);
          if (
            owner?.book !== project.book ||
            owner?.edition !== project.edition
          )
            throw new AudioProjectError(
              "An existing chapter audio is protected. Create a new audio version.",
            );
        }
        const segments = await Promise.all(
          chapter.verses.map(async (verse) => {
            const ref = `${chapter.chapter}:${verse.verse}`,
              recording = project.recordings[ref];
            if (!recording) throw new Error("Missing verse recording");
            return {
              file: await safeFile(internal, recording.file),
              trim: project.settings.trims[ref],
              pause: project.settings.pauses[ref] ?? 0.35,
            };
          }),
        );
        const temporary = await safeFile(
          internal,
          `${project.book}-${chapter.chapter}-${randomUUID()}.mp3`,
        );
        try {
          await dependencies.assemble(segments, temporary);
          // Recheck ownership before publishing the finished chapter.
          await this.owned(project.edition);
          if (!(await exists(destination))) {
            await fs.link(temporary, destination);
          } else {
            await fs.rename(temporary, destination);
          }
          await atomicJson(receipt, {
            book: project.book,
            edition: project.edition,
          });
          project.chapters[String(chapter.chapter)] = {
            file: filename,
            revision: randomUUID(),
          };
          project.progress =
            85 + Math.round(((index + 1) / chapters.length) * 15);
          project.revision++;
          await this.write(project);
          taskReporter?.({ chapter: chapter.chapter }, "done", 100);
        } finally {
          await fs.unlink(temporary).catch(() => {});
        }
      }
    }
    const id = key(project.edition, project.book);
    const remaining = (this.generationScopes.get(id)?.size ?? 1) > 1;
    if (!remaining) this.closing.add(id);
    project.status = remaining
      ? "running"
      : Object.keys(project.chapters).length === project.chapterCount
        ? "done"
        : "draft";
    project.progress = 100;
    await this.write(project);
  }
}
export type AudioSegment = {
  file: string;
  trim?: { startSeconds: number; endSeconds: number };
  pause: number;
};
export type AudioGenerationDependencies = {
  synthesize: (
    directory: string,
    text: string,
    project: AudioProject,
    input: z.infer<typeof audioGenerateSchema>,
    onProgress?: (progress: number) => void,
  ) => Promise<void>;
  duration: (file: string) => Promise<number>;
  align: (
    file: string,
    duration: number,
    text: string,
    language: string,
    onProgress: (progress: number) => void,
  ) => Promise<z.infer<typeof audioTrimSchema>>;
  assemble: (segments: AudioSegment[], output: string) => Promise<void>;
};
export async function assembleAudioChapter(
  segments: AudioSegment[],
  output: string,
) {
  // Render one segment at a time to avoid command-line and open-file limits on
  // long chapters. Normalize every segment to the same PCM layout, then concat.
  const staging = await fs.mkdtemp(
    path.join(path.dirname(output), ".chapter-"),
  );
  try {
    const names: string[] = [];
    for (const [index, segment] of segments.entries()) {
      const name = `${index}.wav`;
      names.push(name);
      const filter = [
        segment.trim
          ? `atrim=start=${segment.trim.startSeconds}:end=${segment.trim.endSeconds},asetpts=PTS-STARTPTS`
          : "asetpts=PTS-STARTPTS",
        `apad=pad_dur=${segment.pause}`,
      ].join(",");
      await execute(
        config.ffmpegBin,
        [
          "-v",
          "error",
          "-nostdin",
          "-i",
          segment.file,
          "-af",
          filter,
          "-ar",
          "24000",
          "-ac",
          "1",
          "-c:a",
          "pcm_s16le",
          path.join(staging, name),
        ],
        { timeout: 120000 },
      );
    }
    const list = path.join(staging, "concat.txt");
    await fs.writeFile(list, names.map((name) => `file '${name}'`).join("\n"));
    await execute(
      config.ffmpegBin,
      [
        "-v",
        "error",
        "-nostdin",
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        list,
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        output,
      ],
      { timeout: 120000 },
    );
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
const productionDependencies: AudioGenerationDependencies = {
  align: async (file, duration, text, language, onProgress) => {
    const { alignGeneratedSpeech } = await import("./forced-alignment.js");
    const {
      cues: [cue],
    } = await alignGeneratedSpeech(
      file,
      duration,
      language,
      [{ id: "verse", text, start: 0, end: duration }],
      config.ffmpegBin,
      onProgress,
    );
    return { startSeconds: cue.start, endSeconds: cue.end };
  },
  synthesize: async (directory, text, project, input, onProgress) => {
    // Adapted pronunciation text is a one-off request, never a saved transcript.
    const staging = await fs.mkdtemp(path.join(directory, ".speech-"));
    try {
      await generateVoice(
        staging,
        {
          templates: { intro: "", outro: "" },
          scriptOverrides: { intro: text },
          locale: project.version.locale,
          baseVoice: project.settings.baseVoice,
          voiceModel: input.voiceModel,
          voiceDecoder: input.voiceDecoder,
          voiceParameters: input.voiceParameters,
          singleUtterance: true,
          voiceTextAdaptations: input.voiceTextAdaptations,
          reference: "",
          version: project.version.label,
          book: project.title,
          start: "",
          end: "",
          passage_id: project.book,
        },
        true,
        "intro",
        onProgress,
      );
      await fs.rename(
        path.join(staging, "intro.wav"),
        path.join(directory, "verse.wav"),
      );
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  },
  duration: async (file) =>
    Number(
      (
        await execute(config.ffprobeBin, [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          file,
        ])
      ).stdout.trim(),
    ),
  assemble: assembleAudioChapter,
};
