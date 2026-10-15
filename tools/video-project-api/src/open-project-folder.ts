import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existingOutputMedia } from "./existing-projects.js";

const execFileAsync = promisify(execFile);

const finderScript = `on run argv
  set folderPath to item 1 of argv
  tell application "Finder"
    set projectFolder to folder (POSIX file folderPath as alias)
    open projectFolder
    set projectWindow to container window of projectFolder
    set current view of projectWindow to list view
    tell list view options of projectWindow
      set sort column to name column
      set sort direction of column id name column to normal
    end tell
    activate
  end tell
end run`;

type RunCommand = (
  command: string,
  args: string[],
  options: { timeout: number },
) => Promise<unknown>;

/** Only open rendered project directories inside the configured output root. */
export async function openProjectFolder(
  directory: string,
  root: string,
  kind: "short" | "long",
  options: {
    platform?: string;
    open?: (directory: string) => Promise<void>;
    run?: RunCommand;
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
      // Pass the path as an argument so quotes and other characters remain data.
      await (options.run ?? execFileAsync)(
        "/usr/bin/osascript",
        ["-e", finderScript, "--", folder],
        { timeout: 30000 },
      );
    })
  )(resolvedDirectory);
}
