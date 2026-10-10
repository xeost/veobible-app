import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existingOutputMedia } from "./existing-projects.js";

const execFileAsync = promisify(execFile);

/** Only open rendered project directories inside the configured output root. */
export async function openProjectFolder(
  directory: string,
  root: string,
  kind: "short" | "long",
  options: {
    platform?: string;
    open?: (directory: string) => Promise<void>;
  } = {},
) {
  if ((options.platform ?? process.platform) !== "darwin")
    throw new Error("Finder is only available on macOS");
  const [resolvedRoot, resolvedDirectory] = await Promise.all([
    fs.realpath(root),
    fs.realpath(directory),
  ]);
  const relative = path.relative(resolvedRoot, resolvedDirectory);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("Project directory is outside the output root");
  if (!(await existingOutputMedia(resolvedDirectory, kind, "video")))
    throw new Error("Project has no final video");
  await (
    options.open ??
    (async (folder: string) => {
      await execFileAsync("/usr/bin/open", ["-a", "Finder", folder], {
        timeout: 5000,
      });
    })
  )(resolvedDirectory);
}
