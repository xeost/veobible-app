export type GenerationQueueItem = {
  id: string;
  projectId: number;
  type: "intro" | "outro" | "video";
  status: "queued" | "running" | "done" | "failed";
  stage: string;
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
};
export const queueChangedEvent = "generation-queue-changed";
