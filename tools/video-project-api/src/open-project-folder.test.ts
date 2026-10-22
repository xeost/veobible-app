import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { openProjectFolder } from "./open-project-folder.js";

test("Finder opens only rendered projects inside their environment output root", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "project-folder-"));
  const root = path.join(temporary, "outputs-dev");
  const production = path.join(temporary, "outputs");
  const opened: string[] = [];
  const options = {
    platform: "darwin",
    open: async (folder: string) => {
      opened.push(folder);
    },
  };
  try {
    for (const kind of ["short", "long"] as const) {
      const folder = path.join(root, "rv1909", kind);
      await fs.mkdir(folder, { recursive: true });
      await assert.rejects(
        openProjectFolder(folder, root, kind, options),
        /no final video/,
      );
      await fs.writeFile(
        path.join(folder, kind === "short" ? "0-short.mp4" : "0-episode.mp4"),
        "video",
      );
      await openProjectFolder(folder, root, kind, options);
      assert.equal(opened.at(-1), await fs.realpath(folder));
      await assert.rejects(
        openProjectFolder(folder, root, kind, {
          ...options,
          platform: "linux",
        }),
        /macOS/,
      );
    }
    const outside = path.join(production, "rv1909", "short");
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(path.join(outside, "0-short.mp4"), "video");
    await assert.rejects(
      openProjectFolder(outside, root, "short", options),
      /outside/,
    );
    const link = path.join(root, "rv1909", "linked");
    await fs.symlink(outside, link);
    await assert.rejects(
      openProjectFolder(link, root, "short", options),
      /outside/,
    );
    await assert.rejects(
      openProjectFolder(root, root, "short", options),
      /outside/,
    );
    await assert.rejects(
      openProjectFolder(path.join(root, "missing"), root, "short", options),
    );
    assert.equal(opened.length, 2);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("Finder targets the project folder in list view sorted by name ascending and passes paths as data", async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "project-folder-sort-"),
  );
  const folder = path.join(temporary, 'Project "quoted" \\ ñ $(example)');
  try {
    await fs.mkdir(folder);
    await fs.writeFile(path.join(folder, "0-short.mp4"), "video");
    let script = "";
    await openProjectFolder(folder, temporary, "short", {
      platform: "darwin",
      run: async (command, args, options) => {
        assert.equal(command, "/usr/bin/osascript");
        assert.equal(args[0], "-e");
        script = args[1];
        assert.deepEqual(args.slice(2), ["--", await fs.realpath(folder)]);
        assert.equal(options.timeout, 30000);
        assert.ok(!script.includes(folder));
        assert.match(script, /set folderPath to item 1 of argv/);
        // Pin the window by ID; "container window" can resolve to a different
        // window after navigation, especially when requests overlap.
        assert.match(script, /set projectWindow to Finder window id/);
        assert.match(script, /set current view of projectWindow to list view/);
        assert.match(script, /set sort column to column id name column/);
        // Script property readbacks can be stale. Sorting must also use the
        // native command, with all three modifiers (without Option it groups).
        const nativeSort = script.indexOf('keystroke "1"');
        assert.ok(nativeSort > script.indexOf("set sort column"));
        const ascendingSort = script.indexOf("click nameHeader");
        assert.ok(ascendingSort > nativeSort);
        assert.match(script.slice(nativeSort, ascendingSort), /delay 0\.2/);
        assert.match(
          script.slice(nativeSort, ascendingSort),
          /my assertProjectWindow\(projectWindow, projectFolder\)/,
        );
        // Only toggle a visibly descending header. Repeating an already
        // ascending open must not reverse it, even if script readbacks are stale.
        assert.match(
          script,
          /if value of attribute "AXSortDirection" of nameHeader is "AXDescendingSortDirection" then\s+click nameHeader\s+end if/,
        );
        assert.doesNotMatch(script, /set sort direction/);
        assert.match(
          script,
          /set nameHeader to my projectNameHeader\(projectWindow, projectFolder\)/,
        );
        assert.match(
          script,
          /set windowElements to entire contents of front window/,
        );
        assert.match(
          script,
          /if subrole of windowElement is "AXSortButton" then return contents of windowElement/,
        );
        assert.match(
          script.slice(nativeSort),
          /^keystroke "1" using \{control down, option down, command down\}/,
        );
        assert.match(script, /tell application "System Events"/);
        assert.match(script, /if not frontmost then error/);
        assert.match(
          script,
          /id of front Finder window is not id of projectWindow then error/,
        );
        assert.match(
          script,
          /target of projectWindow as alias.*projectFolder as alias/,
        );
        const guard = script.lastIndexOf(
          "my assertProjectWindow(projectWindow, projectFolder)",
          nativeSort,
        );
        assert.ok(guard > script.indexOf("set sort column"));
        const observe = script.indexOf("repeat 20 times", nativeSort);
        const success = script.indexOf("if sortRestored then return", observe);
        assert.ok(observe > ascendingSort && success > observe);
        assert.match(script.slice(observe, success), /delay 0\.1/);
        assert.match(
          script.slice(observe, success),
          /set sortRestored to false/,
        );
        assert.match(
          script.slice(observe, success),
          /name of sort column is not name column/,
        );
        assert.match(
          script.slice(observe, success),
          /value of attribute "AXSortDirection" of nameHeader is not "AXAscendingSortDirection" then\s+set sortRestored to false\s+exit repeat/,
        );
        assert.doesNotMatch(
          script.slice(observe, success),
          /then return|set sort column|keystroke|click nameHeader/,
        );
        assert.match(script, /repeat 3 times/);
        assert.match(
          script,
          /error "Could not sort the project folder by name\."/,
        );
        // Reopening reapplies Finder's saved order and undoes the native sort.
        assert.doesNotMatch(
          script,
          /close projectWindow|default list view options/,
        );
        assert.equal((script.match(/open projectFolder/g) ?? []).length, 1);
      },
    });
    assert.ok(script);
    if (process.platform === "darwin") {
      // Compile against the installed Finder dictionary without executing automation.
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const source = path.join(temporary, "finder.applescript");
      await fs.writeFile(source, script);
      await promisify(execFile)("/usr/bin/osacompile", [
        "-o",
        path.join(temporary, "finder.scpt"),
        source,
      ]);
    }
    await assert.rejects(
      openProjectFolder(folder, temporary, "short", {
        platform: "darwin",
        run: async () => {
          throw new Error("Finder automation denied");
        },
      }),
      /Finder automation denied/,
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
