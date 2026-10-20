import path from "node:path";
import { fileURLToPath } from "node:url";
const toolRoot = fileURLToPath(new URL("..", import.meta.url));
// The proxy supplies the shared root when starting the service.
const workingRoot = path.resolve(toolRoot, process.env.WORKING_DIR || "work");
export const sharedAudioDirectory = path.join(
  workingRoot,
  "material",
  "audios",
);
export const sharedVoiceDirectory = path.join(
  workingRoot,
  "material",
  "voices",
);
function formatDirectory(name: string, fallback: string) {
  const value = process.env[name] || fallback;
  if (value === "." || value === ".." || /[/\\]/.test(value))
    throw new Error(`${name} must be a single directory name`);
  return path.join(workingRoot, value);
}
export const workingDirectories = {
  short: formatDirectory("SHORTS_DIR_NAME", "shorts"),
  book: formatDirectory("BOOKS_DIR_NAME", "books"),
  long: formatDirectory("LONGS_DIR_NAME", "longs"),
};
export function workingDirectory(kind: string) {
  if (kind !== "short" && kind !== "long" && kind !== "book")
    throw new Error("Invalid video format");
  return workingDirectories[kind];
}
export type OutputEnvironment = "production" | "development";
export const audioOutputRoot = (
  environment: OutputEnvironment = "production",
) =>
  environment === "development"
    ? path.join(sharedAudioDirectory, "dev")
    : sharedAudioDirectory;
export const outputRoot = (
  kind: string,
  environment: OutputEnvironment = "production",
) =>
  path.join(
    workingDirectory(kind),
    environment === "development" ? "outputs-dev" : "outputs",
  );
