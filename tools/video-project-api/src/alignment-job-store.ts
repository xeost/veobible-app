import fs from "node:fs/promises";
import path from "node:path";
import type { AlignmentJob } from "./forced-alignment-result.js";

export const alignmentIsPending = (job: AlignmentJob) =>
  job.status === "queued" || job.status === "running";

/** A whole-project analysis overlaps every section; separate sections can queue together. */
export function alignmentScopePending(
  jobs: AlignmentJob[],
  sectionIndex?: number,
) {
  return jobs.some(
    (job) =>
      alignmentIsPending(job) &&
      (sectionIndex === undefined ||
        job.sectionIndex === undefined ||
        job.sectionIndex === sectionIndex),
  );
}

export class AlignmentJobStore {
  private projects = new Map<string, Promise<AlignmentJob[]>>();

  list(file: string): Promise<AlignmentJob[]> {
    let loaded = this.projects.get(file);
    if (!loaded) {
      loaded = this.recover(file).catch((error) => {
        this.projects.delete(file);
        throw error;
      });
      this.projects.set(file, loaded);
    }
    return loaded;
  }

  private async recover(file: string) {
    const jobs: AlignmentJob[] = [];
    // Keep the old single-result file readable after upgrading.
    try {
      jobs.push(JSON.parse(await fs.readFile(file, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const directory = file.replace(/\.json$/, "");
    let names: string[] = [];
    try {
      names = await fs.readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const name of names.filter((name) => name.endsWith(".json"))) {
      const job: AlignmentJob = JSON.parse(
        await fs.readFile(path.join(directory, name), "utf8"),
      );
      const existing = jobs.findIndex((item) => item.id === job.id);
      if (existing >= 0) jobs[existing] = job;
      else jobs.push(job);
    }
    jobs.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    for (const job of jobs) {
      if (!alignmentIsPending(job)) continue;
      job.status = "failed";
      job.stage = "Interrupted";
      await this.save(file, job);
    }
    return jobs;
  }

  async reserve(file: string, job: AlignmentJob) {
    const jobs = await this.list(file);
    // Reserve before any filesystem await, including against simultaneous submissions.
    if (alignmentScopePending(jobs, job.sectionIndex)) return false;
    jobs.push(job);
    try {
      await this.save(file, job);
    } catch (error) {
      jobs.splice(jobs.indexOf(job), 1);
      throw error;
    }
    return true;
  }

  async save(file: string, job: AlignmentJob) {
    const directory = file.replace(/\.json$/, "");
    const destination = path.join(directory, `${job.id}.json`);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(destination + ".tmp", JSON.stringify(job));
    await fs.rename(destination + ".tmp", destination);
  }
}
