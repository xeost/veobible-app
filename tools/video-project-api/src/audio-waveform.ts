import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { encodeWaveform, decodeWaveform } from "./waveform-format.js";

const pending = new Map<string, Promise<{ file: string; etag: string }>>();
const validated = new Map<string, string>();
let active = 0;
const waiting: (() => void)[] = [];

/** Stream PCM instead of holding a decoded recording in memory; retain every channel's peaks. */
async function calculate(file: string, ffmpeg: string): Promise<ArrayBuffer> {
  const child = spawn(
    ffmpeg,
    [
      "-v",
      "error",
      "-nostdin",
      "-threads",
      "1",
      "-i",
      file,
      "-vn",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-f",
      "f32le",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-4096);
  });
  const closed = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Waveform calculation failed: ${stderr}`)),
    );
  });
  // The rejection may arrive while stdout is still being read.
  void closed.catch(() => {});
  const timeout = setTimeout(() => child.kill("SIGKILL"), 120_000);
  const peaks: number[] = [];
  let remainder: Buffer = Buffer.alloc(0);
  let samples = 0;
  let peak = 0;
  try {
    for await (const chunk of child.stdout) {
      const bytes = remainder.length
        ? Buffer.concat([remainder, chunk])
        : (chunk as Buffer);
      const end = bytes.length - (bytes.length % 4);
      for (let i = 0; i < end; i += 4) {
        peak = Math.max(peak, Math.abs(bytes.readFloatLE(i)));
        samples++;
        // 48 stereo frames per millisecond, without averaging away short peaks.
        if (samples % 96 === 0) {
          peaks.push(peak);
          peak = 0;
        }
      }
      remainder = bytes.subarray(end);
    }
    await closed;
    if (!samples || remainder.length) throw new Error("Invalid waveform audio");
    if (samples % 96) peaks.push(peak);
    return encodeWaveform({
      duration: samples / 96000,
      interval: 0.001,
      amplitudes: Float32Array.from(peaks),
    });
  } finally {
    clearTimeout(timeout);
    child.kill();
  }
}

/** Sidecars follow the exact normalized recording, surviving service and browser restarts. */
export async function audioWaveform(source: string, ffmpeg: string) {
  const stat = await fs.stat(source);
  const revision = createHash("sha256")
    .update(
      JSON.stringify([
        "waveform-v1",
        source,
        stat.size,
        stat.mtimeMs,
        stat.ctimeMs,
      ]),
    )
    .digest("hex");
  const file = `${source}.waveform-${revision}.bin`;
  const etag = `"${revision}"`;
  const existing = pending.get(file);
  if (existing) return existing;
  const task = (async () => {
    try {
      const sidecar = await fs.stat(file);
      const identity = JSON.stringify([
        sidecar.size,
        sidecar.mtimeMs,
        sidecar.ctimeMs,
      ]);
      if (validated.get(file) !== identity) {
        const bytes = await fs.readFile(file);
        decodeWaveform(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
        );
        validated.set(file, identity);
        if (validated.size > 128)
          validated.delete(validated.keys().next().value!);
      }
      return { file, etag };
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code &&
        (error as NodeJS.ErrnoException).code !== "ENOENT"
      )
        throw error;
    }
    if (active >= 2)
      await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(
        temporary,
        new Uint8Array(await calculate(source, ffmpeg)),
        { flag: "wx" },
      );
      const current = await fs.stat(source);
      if (
        current.size !== stat.size ||
        current.mtimeMs !== stat.mtimeMs ||
        current.ctimeMs !== stat.ctimeMs
      )
        throw new Error("Recording changed during waveform preparation");
      await fs.rename(temporary, file);
      return { file, etag };
    } finally {
      try {
        await fs.rm(temporary, { force: true });
      } finally {
        const next = waiting.shift();
        if (next) next();
        else active--;
      }
    }
  })();
  pending.set(file, task);
  try {
    return await task;
  } finally {
    pending.delete(file);
  }
}
