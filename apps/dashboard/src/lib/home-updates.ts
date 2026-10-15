import type { GenerationQueueState } from "./generation-queue";

export const projectChangedEvent = "video-project-changed";

/** Refresh on lifecycle changes, independently of progress ticks and history visibility. */
export function homeQueueKey(queue: GenerationQueueState) {
  return JSON.stringify([
    queue.connected,
    queue.summary.completed,
    queue.summary.total,
    queue.items
      .map(({ id, status }) => [id, status])
      .sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

export function projectRenderStatus(
  queue: GenerationQueueState,
  projectId: number,
  kind: string,
) {
  if (!queue.connected) return undefined;
  return queue.items.find(
    (item) =>
      item.projectId === projectId &&
      item.kind === kind &&
      item.type === "video" &&
      (item.status === "running" || item.status === "queued"),
  )?.status;
}

/** Coalesce event bursts without dropping a completion that arrives during a refresh. */
export function createHomeRefresh(
  refresh: (signal: AbortSignal) => Promise<void>,
  visible: () => boolean,
) {
  const controller = new AbortController();
  let fetching = false;
  let again = false;
  const request = async () => {
    if (controller.signal.aborted || !visible()) return;
    if (fetching) {
      again = true;
      return;
    }
    fetching = true;
    try {
      do {
        again = false;
        try {
          await refresh(controller.signal);
        } catch {
          // Keep the last view; the next event or periodic refresh can retry.
        }
      } while (again && !controller.signal.aborted && visible());
    } finally {
      fetching = false;
    }
  };
  return { request, stop: () => controller.abort() };
}
