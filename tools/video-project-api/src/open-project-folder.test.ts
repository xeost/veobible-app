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
        assert.match(
          script,
          /set projectWindow to container window of projectFolder/,
        );
        assert.match(script, /set current view of projectWindow to list view/);
        assert.match(script, /set sort column to column id name column/);
        assert.match(
          script,
          /set sort direction of column id name column to normal/,
        );
        assert.match(script, /repeat 20 times/);
        assert.match(script, /name of sort column is name column/);
        assert.match(
          script,
          /sort direction of column id name column is normal/,
        );
        assert.match(
          script,
          /error "Could not sort the project folder by name\."/,
        );
        // A property readback alone doesn't refresh Finder's visible rows.
        // Keep the close/reopen scoped to the project rather than whichever
        // Finder window happens to be in front when automation runs.
        const configure = script.indexOf(
          "set sort column to column id name column",
        );
        const close = script.indexOf("close projectWindow");
        const reopen = script.indexOf("open projectFolder", close);
        assert.ok(configure >= 0 && close > configure && reopen > close);
        assert.match(
          script.slice(close, reopen),
          /close projectWindow\s+delay 0\.25/,
        );
        assert.match(
          script.slice(configure, close),
          /target of projectWindow as alias.*projectFolder as alias/,
        );
        assert.match(
          script.slice(reopen),
          /name of sort column is not name column/,
        );
        // Do not return on the first successful read after reopening. A late
        // restoration must trigger configuration and another visible refresh.
        const observe = script.indexOf("repeat 20 times", reopen);
        const success = script.indexOf("if sortRestored then return", observe);
        const repair = script.indexOf(
          "my configureProjectWindow(projectWindow, projectFolder)",
          success,
        );
        assert.ok(observe > reopen && success > observe && repair > success);
        assert.match(script.slice(observe, success), /delay 0\.1/);
        assert.match(script.slice(observe, success), /set sortRestored to false/);
        assert.doesNotMatch(script.slice(observe, success), /then return/);
        assert.match(script, /repeat 3 times/);
        assert.match(script, /stableSamples >= 10/);
        assert.doesNotMatch(script.slice(reopen), /set sort column/);
        assert.doesNotMatch(
          script,
          /front window|window 1|default list view options/,
        );
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
