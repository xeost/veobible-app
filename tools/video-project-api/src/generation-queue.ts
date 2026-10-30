import { clampProgress } from "./generation-progress.js";
export type GenerationType =
  | "voice-sample"
  | "audio-verse"
  | "audio-chapter"
  | "intro"
  | "outro"
  | `reading-${number}`
  | `chapter-${number}`
  | "video"
  | "alignment"
  | `alignment-${number}`;
export type QueueJob = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  progress?: number;
};
type Entry = {
  projectId: number | null;
  outputEnvironment?: "production" | "development";
  kind: "short" | "long" | "book" | "audio" | "voice-sample";
  voice?: string;
  locale?: "en" | "es" | "pt";
  chapter?: number;
  verse?: number;
  groupId?: string;
  speechBlock?: string;
  verseEnd?: number;
  type: GenerationType;
  job: QueueJob;
  createdAt: string;
  finishedAt?: string;
};
export class GenerationQueue {
  private entries: Entry[] = [];
  private tail = Promise.resolve();
  private batch: Entry[] = [];
  get pendingCount() {
    return this.entries.filter(({ job }) =>
      ["queued", "running"].includes(job.status),
    ).length;
  }
  hasPending(
    projectId: number,
    type: GenerationType,
    environment: "production" | "development" = "production",
  ) {
    return this.entries.some(
      (entry) =>
        entry.projectId === projectId &&
        entry.type === type &&
        (entry.outputEnvironment ?? "production") === environment &&
        ["queued", "running"].includes(entry.job.status),
    );
  }
  enqueue(
    metadata: Pick<
      Entry,
      "projectId" | "kind" | "type" | "outputEnvironment" | "voice" | "locale"
    >,
    job: QueueJob,
    run: () => Promise<void>,
  ) {
    const entry: Entry = {
      ...metadata,
      job,
      createdAt: new Date().toISOString(),
    };
    if (this.pendingCount === 0) this.batch = [];
    job.progress = 0;
    this.batch.push(entry);
    this.entries.push(entry);
    this.tail = this.tail.then(async () => {
      job.status = "running";
      try {
        await run();
        if (job.status === "running") job.status = "done";
        if (job.status === "done") job.progress = 100;
      } catch (error) {
        job.status = "failed";
        console.error("Generation failed", error);
      } finally {
        entry.finishedAt = new Date().toISOString();
        // Keep bounded recent history without removing pending work.
        while (this.entries.length > 100) {
          const index = this.entries.findIndex(({ job }) =>
            ["done", "failed"].includes(job.status),
          );
          if (index < 0) break;
          this.entries.splice(index, 1);
        }
      }
    });
  }
  /** One serialized operation with individually visible verse/assembly tasks. */
  enqueueGroup(
    items: {
      metadata: Omit<Entry, "job" | "createdAt" | "finishedAt">;
      job: QueueJob;
    }[],
    run: () => Promise<void>,
  ) {
    if (this.pendingCount === 0) this.batch = [];
    const entries: Entry[] = items.map(({ metadata, job }) => ({
      ...metadata,
      job,
      createdAt: new Date().toISOString(),
    }));
    for (const entry of entries) {
      entry.job.progress = 0;
      this.entries.push(entry);
      this.batch.push(entry);
    }
    this.tail = this.tail.then(async () => {
      try {
        await run();
      } catch (error) {
        console.error("Audio generation group failed", error);
      } finally {
        for (const entry of entries) {
          if (["queued", "running"].includes(entry.job.status))
            entry.job.status = "failed";
          entry.finishedAt ??= new Date().toISOString();
        }
        while (this.entries.length > 100) {
          const index = this.entries.findIndex(({ job }) =>
            ["done", "failed"].includes(job.status),
          );
          if (index < 0) break;
          this.entries.splice(index, 1);
        }
      }
    });
  }
  private visibleEntries(entries: Entry[]) {
    const result: Entry[] = [];
    const blocks = new Map<string, Entry[]>();
    for (const entry of entries) {
      if (!entry.speechBlock) {
        result.push(entry);
        continue;
      }
      const members = blocks.get(entry.speechBlock);
      if (members) members.push(entry);
      else {
        blocks.set(entry.speechBlock, [entry]);
        result.push(entry);
      }
    }
    return result.map((entry) => {
      const members = entry.speechBlock
        ? blocks.get(entry.speechBlock)!
        : [entry];
      if (members.length === 1) return entry;
      const pending = members.filter((e) =>
        ["queued", "running"].includes(e.job.status),
      );
      const status = pending.length
        ? members.some((e) => e.job.status !== "queued")
          ? "running"
          : "queued"
        : members.some((e) => e.job.status === "failed")
          ? "failed"
          : "done";
      const progress =
        members.reduce(
          (sum, e) =>
            sum +
            (e.job.status === "done"
              ? 100
              : e.job.status === "queued"
                ? 0
                : clampProgress(e.job.progress ?? 0)),
          0,
        ) / members.length;
      return {
        ...entry,
        verseEnd: Math.max(...members.map((e) => e.verse ?? 0)),
        finishedAt: pending.length
          ? undefined
          : members
              .map((e) => e.finishedAt ?? "")
              .sort()
              .at(-1),
        job: { ...entry.job, id: entry.speechBlock!, status, progress },
      } satisfies Entry;
    });
  }
  snapshot() {
    let position = 0;
    return this.visibleEntries(this.entries).map(({ job, ...entry }) => ({
      ...entry,
      id: job.id,
      status: job.status,
      stage: job.stage,
      progress:
        job.status === "done"
          ? 100
          : job.status === "queued"
            ? 0
            : clampProgress(job.progress ?? 0),
      position: job.status === "queued" ? ++position : null,
    }));
  }
  summary(environment?: "production" | "development") {
    const entries = this.visibleEntries(this.batch).filter(
      (entry) =>
        !environment ||
        (entry.outputEnvironment ?? "production") === environment,
    );
    const completed = entries.filter(({ job }) =>
      ["done", "failed"].includes(job.status),
    ).length;
    const progress = entries.length
      ? entries.reduce(
          (sum, { job }) =>
            sum +
            (["done", "failed"].includes(job.status)
              ? 100
              : job.status === "queued"
                ? 0
                : clampProgress(job.progress ?? 0)),
          0,
        ) / entries.length
      : 0;
    return {
      progress:
        completed < entries.length
          ? Math.min(99, Math.round(progress))
          : Math.round(progress),
      completed,
      total: entries.length,
    };
  }
}
