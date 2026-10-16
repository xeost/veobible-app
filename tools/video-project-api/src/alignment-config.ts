import path from "node:path";
import { fileURLToPath } from "node:url";

export const alignmentWorkerRoot = fileURLToPath(
  new URL("../../forced-aligner/", import.meta.url),
);
export function alignmentWorkerConfig() {
  return {
    python:
      process.env.VIDEO_ALIGNER_PYTHON ||
      path.join(alignmentWorkerRoot, ".venv/bin/python"),
    script:
      process.env.VIDEO_ALIGNER_SCRIPT ||
      path.join(alignmentWorkerRoot, "cli.py"),
    model:
      process.env.VIDEO_ALIGNER_MODEL ||
      "mlx-community/Qwen3-ForcedAligner-0.6B-8bit",
    asrModel:
      process.env.VIDEO_ALIGNER_ASR_MODEL ||
      "mlx-community/Qwen3-ASR-0.6B-8bit",
  };
}
