import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sharedAudioDirectory } from "./working-directories.js";
import { audioDurationSeconds } from "./engines/long/episodes.js";
import { config } from "./engines/long/config.js";
import { alignGeneratedSpeech } from "./forced-alignment.js";
import { alignmentWorkerConfig } from "./alignment-config.js";
import { readBibleDataFile } from "./bible-data.js";
import { AudioProjectError } from "./audio-projects.js";
import {
  audioVersionSchema,
  audioBookSchema,
  type AudioProject,
} from "./audio-project-schema.js";
import type { OriginalAudioState } from "./original-audio-schema.js";

const versesSchema = z
  .array(
    z.object({ verse: z.number().int().positive(), text: z.string().min(1) }),
  )
  .min(1);
type Verses = z.infer<typeof versesSchema>;
type Scope = Pick<AudioProject, "version" | "book" | "order" | "chapterCount">;
type Entry = OriginalAudioState & { touched: number };
type Enqueue = (run: () => Promise<void>, progress: () => number) => void;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Read-only access to unsuffixed chapter recordings; never consult generated editions. */
export class OriginalAudioComparisons {
  private cache = new Map<string, Entry>();
  constructor(
    private root = sharedAudioDirectory,
    private dependencies = {
      duration: audioDurationSeconds,
      align: alignGeneratedSpeech,
      verses: async (project: Scope, chapter: number): Promise<Verses> =>
        versesSchema.parse(
          JSON.parse(
            await readBibleDataFile(
              path.join(
                project.version.locale,
                project.version.code,
                project.book,
                `${chapter}.json`,
              ),
            ),
          ),
        ),
    },
  ) {}
  async source(project: Scope, chapter: number) {
    audioVersionSchema.parse(project.version);
    audioBookSchema.parse(project.book);
    z.number().int().positive().parse(project.order);
    z.number().int().positive().max(project.chapterCount).parse(chapter);
    const directory = path.join(this.root, project.version.code);
    for (const dir of [this.root, directory]) {
      try {
        const stat = await fs.lstat(dir);
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }
    const prefix = `${String(project.order).padStart(2, "0")}-${project.book}-${chapter}`;
    for (const extension of [".mp3", ".m4a", ".MP3", ".M4A"]) {
      const file = path.join(directory, prefix + extension);
      try {
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        return {
          file,
          revision: digest([
            file,
            stat.dev,
            stat.ino,
            stat.size,
            stat.mtimeMs,
            stat.ctimeMs,
          ]),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return null;
  }
  async availableChapters(project: Scope) {
    const available = await Promise.all(
      Array.from({ length: project.chapterCount }, async (_, index) =>
        (await this.source(project, index + 1)) ? index + 1 : null,
      ),
    );
    return available.filter((chapter): chapter is number => chapter !== null);
  }
  async media(project: Scope, chapter: number, revision: string | null) {
    const source = await this.source(project, chapter);
    if (!source || !revision || revision !== source.revision)
      throw new AudioProjectError(
        "The original recording changed or is unavailable. Prepare it again.",
        409,
      );
    return source.file;
  }
  async inspect(
    project: Scope,
    chapter: number,
    start: boolean,
    enqueue: Enqueue,
  ): Promise<OriginalAudioState> {
    const source = await this.source(project, chapter);
    if (!source) return { available: false, status: "idle", progress: 0 };
    const verses = await this.dependencies.verses(project, chapter);
    const cacheKey = digest([
      source.revision,
      project.version.locale,
      verses,
      alignmentWorkerConfig(),
    ]);
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (
        !["queued", "running"].includes(entry.status) &&
        (now - entry.touched > 30 * 60 * 1000 || this.cache.size > 32)
      )
        this.cache.delete(key);
    }
    let entry = this.cache.get(cacheKey);
    if (!entry || (start && entry.status === "failed")) {
      if (!start) return { available: true, status: "idle", progress: 0 };
      entry = {
        available: true,
        status: "queued",
        progress: 0,
        revision: source.revision,
        touched: now,
      };
      this.cache.set(cacheKey, entry);
      const job = entry;
      enqueue(
        async () => {
          job.status = "running";
          try {
            const duration = await this.dependencies.duration(source.file);
            const weights = verses.map((verse) =>
              Math.max(1, verse.text.split(/\s+/u).length),
            );
            const total = weights.reduce((sum, value) => sum + value, 0);
            let elapsed = 0;
            const segments = verses.map((verse, index) => {
              const start = (duration * elapsed) / total;
              elapsed += weights[index];
              return {
                id: `${chapter}:${verse.verse}`,
                text: verse.text.replace(/\(H\d+-\d+\)/g, "").trim(),
                start,
                end: (duration * elapsed) / total,
              };
            });
            const result = await this.dependencies.align(
              source.file,
              duration,
              project.version.locale,
              segments,
              config.ffmpegBin,
              (value) => {
                job.progress = value;
              },
              true,
            );
            if (
              (await this.source(project, chapter))?.revision !==
              source.revision
            )
              throw new Error("Original recording changed during alignment");
            job.duration = duration;
            job.cues = result.cues;
            job.status = "done";
            job.progress = 100;
          } catch (error) {
            job.status = "failed";
            console.error("Original audio comparison failed", error);
            throw error;
          } finally {
            job.touched = Date.now();
          }
        },
        () => job.progress,
      );
    }
    entry.touched = now;
    const { touched: _, ...state } = entry;
    return state;
  }
}
