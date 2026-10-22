import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existingOutputMedia } from "./existing-projects.js";

const execFileAsync = promisify(execFile);

const finderScript = `on assertProjectWindow(projectWindow, projectFolder)
  tell application "Finder"
    if (target of projectWindow as alias) is not (projectFolder as alias) then error "Project folder window changed."
    if id of front Finder window is not id of projectWindow then error "Project folder window is no longer in front."
  end tell
end assertProjectWindow

on projectNameHeader(projectWindow, projectFolder)
  my assertProjectWindow(projectWindow, projectFolder)
  tell application "System Events"
    tell process "Finder"
      if not frontmost then error "Finder is no longer in front."
      set windowElements to entire contents of front window
      -- Name is the first column in Finder's list view. Use its accessibility
      -- role instead of its title so this also works with localized Finder.
      repeat with windowElement in windowElements
        if role of windowElement is "AXButton" then
          if subrole of windowElement is "AXSortButton" then return contents of windowElement
        end if
      end repeat
    end tell
  end tell
  error "Could not find the project folder Name column."
end projectNameHeader

on run argv
  set folderPath to item 1 of argv
  tell application "Finder"
    set projectFolder to folder (POSIX file folderPath as alias)
    open projectFolder
    set projectWindow to Finder window id (id of container window of projectFolder)
    set index of projectWindow to 1
    activate
    set current view of projectWindow to list view
  end tell
  delay 0.3
  repeat 3 times
    my assertProjectWindow(projectWindow, projectFolder)
    tell application "Finder"
      set current view of projectWindow to list view
      tell list view options of projectWindow
        set sort column to column id name column
      end tell
    end tell
    -- Finder's AppleScript properties can disagree with its visible sort.
    -- Apply the native Sort By > Name command (not Group By > Name) too.
    -- Never close/reopen: that can restore the previous Date Added order.
    my assertProjectWindow(projectWindow, projectFolder)
    tell application "System Events"
      tell process "Finder"
        if not frontmost then error "Finder is no longer in front."
        keystroke "1" using {control down, option down, command down}
      end tell
    end tell
    -- The native command can leave Name descending. Read the visible header,
    -- since setting AppleScript's direction can leave the displayed rows stale.
    delay 0.2
    set nameHeader to my projectNameHeader(projectWindow, projectFolder)
    my assertProjectWindow(projectWindow, projectFolder)
    tell application "System Events"
      tell process "Finder"
        if not frontmost then error "Finder is no longer in front."
        if value of attribute "AXSortDirection" of nameHeader is "AXDescendingSortDirection" then
          click nameHeader
        end if
      end tell
    end tell
    -- Observe without writes so a delayed restoration triggers another native
    -- sort rather than being hidden by continuously setting script properties.
    set sortRestored to true
    repeat 20 times
      delay 0.1
      my assertProjectWindow(projectWindow, projectFolder)
      tell application "Finder"
        if current view of projectWindow is not list view then error "Project folder view changed."
        tell list view options of projectWindow
          if (name of sort column is not name column) or (sort direction of column id name column is not normal) then
            set sortRestored to false
            exit repeat
          end if
        end tell
      end tell
      tell application "System Events"
        tell process "Finder"
          if not frontmost then error "Finder is no longer in front."
          if value of attribute "AXSortDirection" of nameHeader is not "AXAscendingSortDirection" then
            set sortRestored to false
            exit repeat
          end if
        end tell
      end tell
    end repeat
    if sortRestored then return
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
  kind: "short" | "long" | "book",
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
