export type GenerationQueueItem = {
  id: string;
  projectId: number;
  type:
    | "audio-verse"
    | "audio-chapter"
    | "intro"
    | "outro"
    | `reading-${number}`
    | `chapter-${number}`
    | "video"
    | "alignment"
    | `alignment-${number}`;
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  progress: number;
  position: number | null;
  createdAt: string;
  finishedAt?: string;
  title: string;
  kind: "short" | "long" | "book" | "audio";
  chapter?: number;
  verse?: number;
  groupId?: string;
  version: string;
  href: string;
};
export type GenerationQueueState = {
  connected: boolean;
  items: GenerationQueueItem[];
  history?: GenerationQueueItem[];
  summary: { progress: number; completed: number; total: number };
};
export const queueChangedEvent = "generation-queue-changed";
