import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
test("configured format roots independently locate assets, generated voices and final outputs", async () => {
  const short = path.join(os.tmpdir(), "veobible-short-path-test"),
    long = path.join(os.tmpdir(), "veobible-long-path-test");
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
        SHORTS_WORKING_DIR: short,
        LONGS_WORKING_DIR: long,
      },
    },
  );
  assert.deepEqual(
    JSON.parse(stdout),
    [short, long].map((root) => ({
      root,
      videos: path.join(root, "material", "videos"),
      voices: path.join(root, "material", "voices"),
      output: path.join(root, "outputs", "rv1909", "project"),
      source: path.join(root, "outputs", "rv1909", "project", "_internal"),
      development: path.join(root, "outputs-dev", "rv1909", "project"),
      developmentSource: path.join(root, "outputs-dev", "rv1909", "project", "_internal"),
    })),
  );
});
