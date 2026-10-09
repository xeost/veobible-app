import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { workingDirectory } from "./working-directories.js";

export interface ChapterVoiceIdentity {
  chapter: number;
  locale: "en" | "es" | "pt";
  complete: boolean;
}

async function available(file: string) {
  return fs.stat(file).then(
    (stat) => stat.isFile() && stat.size > 0,
    () => false,
  );
}

/** Full-chapter scripts are identical across books, Bible versions and output environments. */
export class ChapterVoiceCache {
  constructor(private readonly workingDir: string) {}

  file(identity: ChapterVoiceIdentity) {
    if (
      !["en", "es", "pt"].includes(identity.locale) ||
      !Number.isInteger(identity.chapter) ||
      identity.chapter < 1 ||
      identity.chapter > 999
    )
      throw new Error("Invalid chapter voice cache key");
    return path.join(
      this.workingDir,
      "cache",
      "chapter-voices",
      identity.locale,
      `chapter-${identity.chapter}.wav`,
    );
  }

  async resolve(projectFile: string, identity: ChapterVoiceIdentity) {
    if (!identity.complete)
      return {
        file: projectFile,
        cached: false,
        available: await available(projectFile),
      };
    const cachedFile = this.file(identity);
    if (!(await available(cachedFile)) && (await available(projectFile))) {
      // Adopt older project recordings once without overwriting an existing shared voice.
      await this.publish(
        projectFile,
        projectFile.replace(/\.wav$/, ".txt"),
        identity,
        false,
      );
    }
    if (await available(cachedFile))
      return { file: cachedFile, cached: true, available: true };
    return { file: cachedFile, cached: true, available: false };
  }

  async publish(
    audio: string,
    script: string,
    identity: ChapterVoiceIdentity,
    replace = true,
  ) {
    if (!identity.complete)
      throw new Error("Partial chapter voices cannot be cached");
    const target = this.file(identity);
    await fs.mkdir(path.dirname(target), { recursive: true });
    for (const [source, destination] of [
      [audio, target],
      [script, target.replace(/\.wav$/, ".txt")],
    ]) {
      if (source === script && !(await available(source))) continue;
      const temporary = path.join(
        path.dirname(target),
        `.writing-${randomUUID()}`,
      );
      try {
        await fs.copyFile(source, temporary);
        if (replace) await fs.rename(temporary, destination);
        else
          await fs.link(temporary, destination).catch((error) => {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          });
      } finally {
        await fs.rm(temporary, { force: true });
      }
    }
    return target;
  }
}

export const chapterVoiceCache = new ChapterVoiceCache(
  workingDirectory("long"),
);
