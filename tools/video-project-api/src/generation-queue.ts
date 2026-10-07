export type GenerationType = "intro" | "outro" | "video";
export type QueueJob = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  stage: string;
};
type Entry = {
  projectId: number;
  outputEnvironment?: "production" | "development";
  kind: "short" | "long";
  type: GenerationType;
  job: QueueJob;
  createdAt: string;
  finishedAt?: string;
};
export class GenerationQueue {
  private entries: Entry[] = [];
  private tail = Promise.resolve();
  get pendingCount() {
    return this.entries.filter(({ job }) =>
      ["queued", "running"].includes(job.status),
    ).length;
  }
  hasPending(projectId: number, type: GenerationType, environment: "production" | "development" = "production") {
    return this.entries.some(
      (entry) =>
        entry.projectId === projectId &&
        entry.type === type &&
        (entry.outputEnvironment ?? "production") === environment &&
        ["queued", "running"].includes(entry.job.status),
    );
  }
  enqueue(
    metadata: Pick<Entry, "projectId" | "kind" | "type" | "outputEnvironment">,
    job: QueueJob,
    run: () => Promise<void>,
  ) {
    const entry: Entry = {
      ...metadata,
      job,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    this.tail = this.tail.then(async () => {
      job.status = "running";
      try {
        await run();
        if (job.status === "running") job.status = "done";
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
  snapshot() {
    let position = 0;
    return this.entries.map(({ job, ...entry }) => ({
      ...entry,
      id: job.id,
      status: job.status,
      stage: job.stage,
      position: job.status === "queued" ? ++position : null,
    }));
  }
}
