import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";

test(
  "HTTP cleanup requires authentication, previews without deleting and respects format/environment",
  { timeout: 30000 },
  async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "cleanup-http-"));
    const socket = net.createServer();
    let child: ReturnType<typeof spawn> | undefined;
    try {
      socket.listen(0, "127.0.0.1");
      await once(socket, "listening");
      const port = (socket.address() as net.AddressInfo).port;
      await new Promise<void>((resolve) => socket.close(() => resolve()));
      const short = path.join(temporary, "short");
      const long = path.join(temporary, "long");
      for (const root of [short, long])
        for (const environment of ["outputs", "outputs-dev"]) {
          const directory = path.join(root, environment, "kjv", "published");
          await fs.mkdir(directory, { recursive: true });
          await fs.writeFile(
            path.join(
              directory,
              root === short ? "0-short.mp4" : "0-episode.mp4",
            ),
            "video",
          );
        }
      const token = "project-cleanup-test-token-1234567890";
      child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
        cwd: new URL("../", import.meta.url),
        env: {
          ...process.env,
          PORT: String(port),
          PROXY_API_TOKEN: token,
          SHORTS_WORKING_DIR: short,
          LONGS_WORKING_DIR: long,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let diagnostics = "";
      child.stderr!.on("data", (chunk) => {
        diagnostics += chunk;
      });
      await new Promise<void>((resolve, reject) => {
        child!.stdout!.on("data", (chunk) => {
          if (String(chunk).includes("Video API:")) resolve();
        });
        child!.once("error", reject);
        child!.once("exit", (code) =>
          reject(new Error(`API exited: ${code} ${diagnostics}`)),
        );
      });
      const base = `http://127.0.0.1:${port}`;
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const input = {
        kind: "short",
        outputEnvironment: "development",
        action: "preview",
        projects: [{ id: 1, version: "kjv", slug: "published" }],
      };
      assert.equal(
        (
          await fetch(`${base}/v1/projects/cleanup-published`, {
            method: "POST",
            body: JSON.stringify(input),
          })
        ).status,
        401,
      );
      const request = async (value: unknown) =>
        fetch(`${base}/v1/projects/cleanup-published`, {
          method: "POST",
          headers,
          body: JSON.stringify(value),
        });
      const preview = await request(input);
      assert.equal(preview.status, 200);
      assert.deepEqual((await preview.json()).eligibleIds, [1]);
      assert.equal(
        await fs.readFile(
          path.join(short, "outputs-dev/kjv/published/0-short.mp4"),
          "utf8",
        ),
        "video",
      );
      const deleted = await request({ ...input, action: "delete" });
      assert.equal(deleted.status, 200);
      assert.deepEqual((await deleted.json()).deletedIds, [1]);
      await assert.rejects(
        fs.stat(path.join(short, "outputs-dev/kjv/published")),
        { code: "ENOENT" },
      );
      assert.equal(
        await fs.readFile(
          path.join(short, "outputs/kjv/published/0-short.mp4"),
          "utf8",
        ),
        "video",
      );
      assert.equal(
        await fs.readFile(
          path.join(long, "outputs-dev/kjv/published/0-episode.mp4"),
          "utf8",
        ),
        "video",
      );
      const invalid = await request({
        ...input,
        action: "delete",
        projects: [{ id: 1, version: "kjv", slug: "../outputs" }],
      });
      assert.equal(invalid.status, 400);
    } finally {
      socket.close();
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await once(child, "exit");
      }
      await fs.rm(temporary, { recursive: true, force: true });
    }
  },
);
