export {
  localModelsSchema,
  localModelRemovalTargets,
  localModelDownloadSchema,
  localModelUpdateSchema,
  type LocalModelUpdate,
  type LocalModels,
} from "../../../../tools/video-project-api/src/local-models-contract";

import type { LocalModels } from "../../../../tools/video-project-api/src/local-models-contract";
type Model = LocalModels["models"][number];
export const isModelDownloading = (model: Model) =>
  model.download?.status === "downloading" ||
  model.download?.status === "verifying";
export function localModelActions(model: Model) {
  const managed =
    Boolean(model.repository) &&
    model.variant !== "custom" &&
    model.status !== "local" &&
    model.status !== "custom";
  return {
    download:
      managed &&
      (model.status !== "downloaded" ||
        model.enabled === false ||
        model.download?.status === "failed" ||
        isModelDownloading(model)),
    remove: managed && model.status === "downloaded" && model.enabled !== false,
    downloadLabel: isModelDownloading(model)
      ? model.download?.status === "verifying"
        ? "Checking downloaded files…"
        : "Downloading model…"
      : model.download?.status === "failed"
        ? "Retry download"
        : "Download model",
  };
}
