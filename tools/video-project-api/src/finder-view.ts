import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const template = fileURLToPath(
  new URL("./assets/finder-list-name-ascending.dsstore", import.meta.url),
);

export async function finderPython() {
  if (process.env.VIDEO_FINDER_PYTHON) return process.env.VIDEO_FINDER_PYTHON;
  // The macOS /usr/bin/python3 shim may require Xcode setup. Prefer an installed Python.
  for (const candidate of ["/opt/homebrew/bin/python3", "/usr/local/bin/python3"])
    if (await fs.access(candidate, constants.X_OK).then(() => true, () => false))
      return candidate;
  return "python3";
}

/** New folders get fresh defaults; existing folders keep their saved view. */
export async function initializeFinderView(
  directory: string,
  options: { created?: boolean } = {},
) {
  try {
    await fs.copyFile(
      template,
      path.join(directory, ".DS_Store"),
      constants.COPYFILE_EXCL,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (process.platform === "darwin")
    await run(await finderPython(), [
      "-I",
      fileURLToPath(new URL("./finder-view.py", import.meta.url)),
      ...(options.created ? ["--force"] : []),
      directory,
    ], { timeout: 15000 });
}
