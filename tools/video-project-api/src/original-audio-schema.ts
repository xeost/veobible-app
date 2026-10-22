export type OriginalAudioState = {
  available: boolean;
  status: "idle" | "queued" | "running" | "done" | "failed";
  progress: number;
  revision?: string;
  duration?: number;
  cues?: { reference: string; text: string; start: number; end: number }[];
};
