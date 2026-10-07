import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));

test("runtime only uses frontend static Bible data and has no dependencies on dashboard or legacy tools", async () => {
  const files = await fs.readdir(path.join(root, "src"), { recursive: true });
  for (const name of files) {
    if (!/\.(ts|tsx)$/.test(name) || name.endsWith(".test.ts")) continue;
    const source = await fs.readFile(path.join(root, "src", name), "utf8");
    assert.doesNotMatch(
      source,
      /shorts-daily-dose|longs-365-days|apps\/dashboard|apps\/frontend\/(?!public\/bible-data)|VEOBIBLE_(SHORTS|LONGS)_/,
      name,
    );
    if (name !== "existing-projects.ts")
      assert.doesNotMatch(
        source,
        /status\.json|default-version-settings\.json/,
        name,
      );
  }
});

test(
  "standalone short and cross-book long pipeline with its own sources and voice adapter",
  { timeout: 240_000 },
  async () => {
    const workspace = await fs.mkdtemp(
      path.join(os.tmpdir(), "veobible-api-isolated-"),
    );
    const isolated = path.join(workspace, "tools", "video-project-api");
    await fs.mkdir(isolated, { recursive: true });
    try {
      for (const name of ["src", "package.json", "tsconfig.json"]) {
        await fs.cp(path.join(root, name), path.join(isolated, name), {
          recursive: true,
        });
      }
      // Narration templates and social accounts arrive in requests; no resource JSON is required.
      // Only this package's installed dependencies are accessible, never a CLI node_modules.
      await fs.symlink(
        path.join(root, "node_modules"),
        path.join(isolated, "node_modules"),
        "dir",
      );
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !key.startsWith("VIDEO_") && !key.startsWith("VEOBIBLE_"),
        ),
      );
      const { stdout } = await execute(
        process.execPath,
        ["--import", "tsx", "src/test-fixtures/standalone.ts"],
        {
          cwd: isolated,
          env: {
            ...env,
            VIDEO_SMOKE_RENDER: process.env.VIDEO_SMOKE_RENDER ?? "0",
          },
          timeout: 230_000,
          maxBuffer: 3 * 1024 * 1024,
        },
      );
      assert.match(stdout, /standalone pipeline passed: short, long/);
      if (process.env.VIDEO_SMOKE_RENDER === "1")
        assert.match(stdout, /standalone renders passed: short, long/);
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  },
);
