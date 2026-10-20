import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
test("format roots keep clips and outputs separate while base voices share the working root", async () => {
  const root = path.join(os.tmpdir(), "veobible-path-test");
  const short = path.join(root, "custom-shorts"),
    long = path.join(root, "custom-longs");
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
    import {config as short} from './src/engines/short/config.ts';
    import {config as long} from './src/engines/long/config.ts';
    import {projectDir,sourceDir} from './src/pipeline.ts';
    console.log(JSON.stringify([short,long].map((config,index)=>({
      root:config.workingDir, videos:config.videosDir, voices:config.voiceDir,
      output:projectDir(index?'long':'short','rv1909','project'),source:sourceDir(index?'long':'short','rv1909','project'),
      development:projectDir(index?'long':'short','rv1909','project','development'),
      developmentSource:sourceDir(index?'long':'short','rv1909','project','development')
    }))));`,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith("VIDEO_"),
          ),
        ),
        WORKING_DIR: root,
        SHORTS_DIR_NAME: "custom-shorts",
        LONGS_DIR_NAME: "custom-longs",
      },
    },
  );
  assert.deepEqual(
    JSON.parse(stdout),
    [short, long].map((formatRoot) => ({
      root: formatRoot,
      videos: path.join(formatRoot, "material", "videos"),
      voices: path.join(root, "material", "voices"),
      output: path.join(formatRoot, "outputs", "rv1909", "project"),
      source: path.join(
        formatRoot,
        "outputs",
        "rv1909",
        "project",
        "_internal",
      ),
      development: path.join(formatRoot, "outputs-dev", "rv1909", "project"),
      developmentSource: path.join(
        formatRoot,
        "outputs-dev",
        "rv1909",
        "project",
        "_internal",
      ),
    })),
  );
});

test("format names default to shorts/longs and reject paths", async () => {
  const execute = promisify(execFile);
  const cwd = fileURLToPath(new URL("..", import.meta.url));
  const root = path.join(os.tmpdir(), "veobible-default-path-test");
  const args = [
    "--import",
    "tsx",
    "--input-type=module",
    "-e",
    "import {workingDirectories} from './src/working-directories.ts'; console.log(JSON.stringify(workingDirectories));",
  ];
  const env = {
    ...process.env,
    WORKING_DIR: root,
    SHORTS_DIR_NAME: "",
    LONGS_DIR_NAME: "",
    BOOKS_DIR_NAME: "",
  };
  const { stdout } = await execute(process.execPath, args, { cwd, env });
  assert.deepEqual(JSON.parse(stdout), {
    short: path.join(root, "shorts"),
    long: path.join(root, "longs"),
    book: path.join(root, "books"),
  });
  for (const name of ["SHORTS_DIR_NAME", "LONGS_DIR_NAME", "BOOKS_DIR_NAME"])
    for (const value of [
      "..",
      ".",
      "/absolute/path",
      "nested/path",
      "nested\\path",
    ])
      await assert.rejects(
        execute(process.execPath, args, {
          cwd,
          env: { ...env, [name]: value },
        }),
        { message: new RegExp(`${name} must be a single directory name`) },
      );
});
