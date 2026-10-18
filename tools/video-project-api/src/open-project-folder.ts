import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existingOutputMedia } from "./existing-projects.js";

const execFileAsync = promisify(execFile);

const finderScript = `on configureProjectWindow(projectWindow, projectFolder)
  tell application "Finder"
    set stableSamples to 0
    repeat 40 times
      -- Stop if the user navigates away while Finder is settling.
      if (target of projectWindow as alias) is not (projectFolder as alias) then error "Project folder window changed."
      try
        set current view of projectWindow to list view
        tell list view options of projectWindow
          set sort column to column id name column
          set sort direction of column id name column to normal
        end tell
        delay 0.1
        tell list view options of projectWindow
          if (name of sort column is name column) and (sort direction of column id name column is normal) then
            set stableSamples to stableSamples + 1
          else
            set stableSamples to 0
          end if
        end tell
        if stableSamples >= 10 then return
      on error
        set stableSamples to 0
      end try
    end repeat
    error "Could not sort the project folder by name."
  end tell
end configureProjectWindow

on run argv
  set folderPath to item 1 of argv
  tell application "Finder"
    set projectFolder to folder (POSIX file folderPath as alias)
    open projectFolder
    activate
    set projectWindow to container window of projectFolder
  end tell
  my configureProjectWindow(projectWindow, projectFolder)
  -- Reopening refreshes the visible rows, but Finder can then asynchronously
  -- restore a previous sort. Observe the whole settling interval without writes;
  -- an immediate successful readback is not evidence that restoration finished.
  repeat 3 times
    tell application "Finder"
      if (target of projectWindow as alias) is not (projectFolder as alias) then error "Project folder window changed."
      close projectWindow
      delay 0.25
      open projectFolder
      activate
      set projectWindow to container window of projectFolder
      set sortRestored to true
      repeat 20 times
        delay 0.1
        if (target of projectWindow as alias) is not (projectFolder as alias) then error "Project folder window changed."
        try
          if current view of projectWindow is not list view then error "Project folder view changed."
          tell list view options of projectWindow
            if (name of sort column is not name column) or (sort direction of column id name column is not normal) then error "Project folder sort changed."
          end tell
        on error
          set sortRestored to false
          exit repeat
        end try
      end repeat
    end tell
    if sortRestored then return
    my configureProjectWindow(projectWindow, projectFolder)
  end repeat
  error "Could not sort the project folder by name."
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
