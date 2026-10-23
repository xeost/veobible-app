import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const pending = new Map<string, Promise<{ stdout: string; stderr: string }>>();
const cached = new Map<string, { stdout: string; stderr: string }>();
let active = 0;
const waiting: (() => void)[] = [];

export function silenceDetectionEnabled() {
  return process.env.VIDEO_SILENCE_DETECTION === "1";
}

/** Bound probes independently of the generation queue; reuse unchanged source analyses. */
export async function analyzeMedia(
  file: string,
  binary: string,
  args: string[],
  maxBuffer = 8 * 1024 * 1024,
) {
  const stat = await fs.stat(file);
  const key = JSON.stringify([
    path.resolve(file), stat.size, stat.mtimeMs, stat.ctimeMs, binary, args,
  ]);
  const hit = cached.get(key);
  if (hit) return hit;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      const result = await execute(binary, args, { maxBuffer, timeout: 120_000 });
      cached.set(key, result);
      if (cached.size > 128) cached.delete(cached.keys().next().value!);
      return result;
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
