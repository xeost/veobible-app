export type VideoRow = {
  id: string;
  title: string;
  kind: string;
  position: number;
  project_id: string | null;
  status: string;
  settings: string | null;
  published_at: string | null;
  used_at?: string | null;
  result: string | null;
  updated_at: string | null;
};

export type VideoKind = "short" | "long";
export const videoStatusLabels: Record<string, string> = {
  draft: "Pendiente",
  queued: "En cola",
  running: "Generando",
  ready: "Generado",
  failed: "Error",
};
