export type VideoRow = {
  id: number;
  title: string;
  kind: string;
  project_id: number;
  status: string;
  progress: number;
  settings: string | null;
  published: number;
  social_video_ids?: string;
  version_id: number;
  version_code: string;
  locale: string;
  label: string;
  result: string | null;
  updated_at: string | null;
};

export type VideoKind = "short" | "long" | "book";
export const videoStatusLabels: Record<string, string> = {
  draft: "Pendiente",
  queued: "En cola",
  running: "Generando",
  ready: "Generado",
  failed: "Error",
};
