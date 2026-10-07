export type GenerationQueueItem = {
  id: string;
  projectId: number;
  type: "intro" | "outro" | "video";
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  progress: number;
  position: number | null;
  createdAt: string;
  title: string;
  kind: "short" | "long";
  version: string;
  href: string;
};
export type GenerationQueueState = {
  connected: boolean;
  items: GenerationQueueItem[];
  summary: { progress: number; completed: number; total: number };
};
export const queueChangedEvent = "generation-queue-changed";
