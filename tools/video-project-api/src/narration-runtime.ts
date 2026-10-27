import { assertNarrationModelEnabled } from "./local-model-state.js";
import { fileURLToPath } from "node:url";
import {
  isCosyNarrationModel,
  isQwenNarrationModel,
} from "./narration-models.js";
export const qwenPython =
  process.env.VIDEO_QWEN_TTS_PYTHON ??
  fileURLToPath(
    new URL("../../voice-generator/.venv-qwen/bin/python", import.meta.url),
  );
export const cosyPython =
  process.env.VIDEO_COSYVOICE_TTS_PYTHON ??
  fileURLToPath(
    new URL(
      "../../voice-generator/.venv-cosyvoice/bin/python",
      import.meta.url,
    ),
  );
export function narrationRuntime(
  model: string,
  python: string,
  env = process.env,
) {
  assertNarrationModelEnabled(model);
  // Every provider inherits Hugging Face's shared cache and standard overrides.
  return {
    python: isCosyNarrationModel(model)
      ? cosyPython
      : isQwenNarrationModel(model)
        ? qwenPython
        : python,
    env,
  };
}
