import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { initializeFinderView, finderPython } from "./finder-view.js";
import { fileURLToPath } from "node:url";

test("parent metadata stores named preferences and preserves other folder records", {
  skip: process.platform !== "darwin",
}, async () => {
  await promisify(execFile)(await finderPython(), [
    "-I",
    fileURLToPath(new URL("./test-fixtures/finder-view.py", import.meta.url)),
  ]);
});

test("Finder template stores list view and ascending Name sorting", {
  skip: process.platform !== "darwin",
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "finder-template-"));
  const directory = path.join(workspace, "project");
  await fs.mkdir(directory);
  try {
    await initializeFinderView(directory);
    const store = await fs.readFile(path.join(directory, ".DS_Store"));
    assert.equal(store.toString("ascii", 4, 8), "Bud1");
    // Each preference is a record for the folder itself (UTF-16BE ".").
    const prefix = Buffer.from([0, 0, 0, 1, 0, 46]);
    for (const key of ["vstl", "icvl"])
      assert.ok(store.includes(Buffer.concat([
        prefix,
        Buffer.from(`${key}typeNlsv`),
      ])));
    for (const key of ["lsvp", "lsvP", "lsvC"]) {
      const record = Buffer.concat([prefix, Buffer.from(`${key}blob`)]);
      const offset = store.indexOf(record);
      assert.ok(offset >= 0, `${key} settings are present`);
      const sizeOffset = offset + record.length;
      const size = store.readUInt32BE(sizeOffset);
      const file = path.join(directory, `${key}.plist`);
      await fs.writeFile(file, store.subarray(sizeOffset + 4, sizeOffset + 4 + size));
      // Decode with macOS's own property-list reader, independently of the generator.
      const { stdout } = await promisify(execFile)("/usr/bin/plutil", [
        "-convert", "json", "-o", "-", file,
      ]);
      const settings = JSON.parse(stdout);
      assert.equal(settings.sortColumn, "name");
      const name = Array.isArray(settings.columns)
        ? settings.columns.find((column: { identifier: string }) => column.identifier === "name")
        : settings.columns.name;
      assert.equal(name.visible, true);
      assert.equal(name.ascending, true);
    }
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test("Finder preferences are seeded once and survive repeated project preparation", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "finder-view-"));
  const directory = path.join(workspace, "project");
  await fs.mkdir(directory);
  try {
    const file = path.join(directory, ".DS_Store");
    const template = await fs.readFile(
      new URL("./assets/finder-list-name-ascending.dsstore", import.meta.url),
    );
    await Promise.all([
      initializeFinderView(directory),
      initializeFinderView(directory),
    ]);
    assert.deepEqual(await fs.readFile(file), template);

    const customized = Buffer.from("Finder preferences changed by the user");
    await fs.writeFile(file, customized);
    await initializeFinderView(directory);
    assert.deepEqual(await fs.readFile(file), customized);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test("Finder initialization reports filesystem failures", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "finder-view-"));
  try {
    await assert.rejects(
      initializeFinderView(path.join(directory, "missing")),
      { code: "ENOENT" },
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("recreated folders replace stale Date Added preferences in their parent", {
  skip: process.platform !== "darwin",
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "finder-recreated-"));
  const directory = path.join(workspace, "project");
  const script = fileURLToPath(new URL("./test-fixtures/finder-view.py", import.meta.url));
  try {
    await fs.mkdir(directory);
    await initializeFinderView(directory);
    await promisify(execFile)(await finderPython(), ["-I", script, "--set-date-added", directory]);
    await fs.rm(directory, { recursive: true });
    await fs.mkdir(directory);
    await initializeFinderView(directory, { created: true });
    await promisify(execFile)(await finderPython(), ["-I", script, "--check", directory]);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test("post-render reset replaces existing sort preferences in both folder parents", {
  skip: process.platform !== "darwin",
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "finder-rendered-"));
  const output = path.join(workspace, "project");
  const sources = path.join(output, "_internal");
  const script = fileURLToPath(new URL("./test-fixtures/finder-view.py", import.meta.url));
  try {
    await fs.mkdir(sources, { recursive: true });
    for (const directory of [output, sources]) {
      await initializeFinderView(directory);
      await promisify(execFile)(await finderPython(), ["-I", script, "--set-date-added", directory]);
    }
    for (const directory of [output, sources])
      await initializeFinderView(directory, { reset: true });
    await promisify(execFile)(await finderPython(), ["-I", script, "--check", output, sources]);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
