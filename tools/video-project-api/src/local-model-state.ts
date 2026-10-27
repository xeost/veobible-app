import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stateFile = () =>
  path.join(
    path.resolve(
      fileURLToPath(new URL("..", import.meta.url)),
      process.env.WORKING_DIR || "work",
    ),
    "disabled-models.json",
  );
export const modelKey = (model: {
  repository: string | null;
  variant: string;
}) => `${model.repository}:${model.variant}`;
export function disabledModels(): string[] {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
      throw new Error("Invalid disabled model list");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
export function setModelEnabled(
  model: { repository: string | null; variant: string },
  enabled: boolean,
) {
  const keys = new Set(disabledModels());
  if (enabled) keys.delete(modelKey(model));
  else keys.add(modelKey(model));
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify([...keys]));
  fs.renameSync(`${file}.tmp`, file);
}
export function assertNarrationModelEnabled(model: string) {
  const variant =
    (
      {
        chatterbox: "chatterbox-original",
        "multilingual-v3": "chatterbox-v3",
        latam: "chatterbox-latam",
        "pt-br": "chatterbox-pt-br",
      } as Record<string, string>
    )[model] ?? model;
  if (disabledModels().some((key) => key.endsWith(`:${variant}`)))
    throw new Error(
      "This voice model is disabled. Enable it in administration tools before generating voices.",
    );
}
