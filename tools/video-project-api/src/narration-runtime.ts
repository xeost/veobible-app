import { fileURLToPath } from "node:url";
import { isQwenNarrationModel } from "./narration-models.js";
export const qwenPython =
  process.env.VIDEO_QWEN_TTS_PYTHON ??
  fileURLToPath(
    new URL("../../voice-generator/.venv-qwen/bin/python", import.meta.url),
  );
export function narrationRuntime(
  model: string,
  python: string,
  env = process.env,
) {
  // Every provider inherits Hugging Face's shared cache and standard overrides.
  return { python: isQwenNarrationModel(model) ? qwenPython : python, env };
}
