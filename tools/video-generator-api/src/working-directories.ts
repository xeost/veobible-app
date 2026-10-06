import path from "node:path";
import { fileURLToPath } from "node:url";
const toolRoot = fileURLToPath(new URL("..", import.meta.url));
export const workingDirectories = {
  short: path.resolve(toolRoot, process.env.SHORTS_WORKING_DIR || "work/short"),
  long: path.resolve(toolRoot, process.env.LONGS_WORKING_DIR || "work/long"),
};
export function workingDirectory(kind: string) {
  if (kind !== "short" && kind !== "long")
    throw new Error("Invalid video format");
  return workingDirectories[kind];
}
export const outputRoot = (kind: string) =>
  path.join(workingDirectory(kind), "outputs");
export const mediaRoot = (kind: string) =>
  path.join(workingDirectory(kind), "media");
