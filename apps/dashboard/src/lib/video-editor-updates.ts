import type { AlignmentJob } from "../../../../tools/video-project-api/src/forced-alignment-result";
export type VideoStateUpdate = {
  cursor: string;
  unchanged?: boolean;
  state?: { status: string; progress: number; result: unknown };
};
export type VideoAlignmentUpdate = {
  cursor: string;
  unchanged?: boolean;
  jobs?: AlignmentJob[];
};

/** Keep results waiting for a local save/apply even when the server has no changes. */
export function mergeVideoAlignmentUpdates(
  current: AlignmentJob[],
  update: VideoAlignmentUpdate,
) {
  if (!update.jobs?.length) return current;
  const ids = new Set(update.jobs.map((job) => job.id));
  return [...update.jobs, ...current.filter((job) => !ids.has(job.id))];
}

/** Polling and focus share one request; focus during a poll queues one full reload. */
export function serializeVideoRefresh(load: (full: boolean) => Promise<void>) {
  let flight: Promise<void> | null = null;
  let fullRequested = false;
  return (full = false): Promise<void> => {
    fullRequested ||= full;
    if (flight) return flight;
    flight = (async () => {
      do {
        const full = fullRequested;
        fullRequested = false;
        await load(full);
      } while (fullRequested);
    })().finally(() => {
      flight = null;
    });
    return flight;
  };
}
