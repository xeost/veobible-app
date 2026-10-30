import type { GenerationQueueItem } from "./generation-queue";

/** Until the queue identifies the active chapters, keep the conservative lock. */
export function audioReviewLocked(
  chapter: number,
  pending: boolean,
  tasks: Pick<GenerationQueueItem, "chapter">[],
) {
  return (
    pending &&
    (tasks.length === 0 ||
      tasks.some((task) => !task.chapter || task.chapter === chapter))
  );
}
