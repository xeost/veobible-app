import { createHash } from "node:crypto";
import type { AlignmentJob } from "./forced-alignment-result.js";

/** Hash/serialize on the local service, never in the dashboard Worker. */
export function inspectionUpdate<T>(value: T, previous: string | null) {
  const cursor = createHash("sha256")
    .update(JSON.stringify(value))
    .digest("base64url");
  return cursor === previous
    ? { unchanged: true as const, cursor }
    : { ...value, cursor };
}

export type AlignmentUpdates = {
  cursor: string;
  unchanged?: boolean;
  jobs?: AlignmentJob[];
};

/** Track small mutable metadata; completed offsets are immutable and sent once.
 * Each file gets an epoch so restart/foreign/expired cursors resync safely. */
export class AlignmentInspectionUpdates {
  private files = new Map<
    string,
    {
      epoch: string;
      revision: number;
      jobs: Map<
        string,
        {
          fingerprint: string;
          result: AlignmentJob["result"];
          revision: number;
        }
      >;
    }
  >();
  read(
    file: string,
    jobs: AlignmentJob[],
    cursor: string | null,
  ): AlignmentUpdates {
    let state = this.files.get(file);
    if (!state) {
      state = { epoch: crypto.randomUUID(), revision: 0, jobs: new Map() };
      this.files.set(file, state);
    }
    for (const job of jobs) {
      const fingerprint = JSON.stringify([
        job.status,
        job.stage,
        job.progress,
        job.sectionIndex,
        job.createdAt,
      ]);
      const previous = state.jobs.get(job.id);
      if (
        !previous ||
        previous.fingerprint !== fingerprint ||
        previous.result !== job.result
      )
        state.jobs.set(job.id, {
          fingerprint,
          result: job.result,
          revision: ++state.revision,
        });
    }
    const [epoch, number] = (cursor ?? "").split(":");
    const revision = Number(number);
    const valid =
      epoch === state.epoch &&
      Number.isSafeInteger(revision) &&
      revision >= 0 &&
      revision <= state.revision;
    const next = `${state.epoch}:${state.revision}`;
    if (valid && revision === state.revision)
      return { cursor: next, unchanged: true };
    return {
      cursor: next,
      jobs: jobs.filter(
        (job) => !valid || state!.jobs.get(job.id)!.revision > revision,
      ),
    };
  }
}
