import { spawn } from "node:child_process";
import type { Duplex } from "node:stream";
import { performance } from "node:perf_hooks";
import { config } from "./config.js";
import { createConnection } from "node:net";
import { randomUUID } from "node:crypto";

export interface PreviewPlayback {
  finished: Promise<void>;
  position(): number;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): void;
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Audio-engine pause with a short volume ramp; never suspend the OS process. */
export async function startPreviewPlayback(file: string, extraArgs: string[] = []): Promise<PreviewPlayback> {
  const pipeName = process.platform === "win32" ? `\\\\.\\pipe\\veobible-preview-${randomUUID()}` : undefined;
  const child = spawn(config.mpvBin, ["--no-config", "--load-scripts=no", "--vid=no", "--audio-display=no",
    "--terminal=no", "--input-terminal=no", "--input-media-keys=no", "--audio-buffer=0.04",
    "--pause", "--volume=0", ...(pipeName ? [`--input-ipc-server=${pipeName}`, "--idle=yes"] : ["--input-ipc-client=fd://3"]),
    ...extraArgs, ...(pipeName ? [] : ["--", file])],
    { stdio: pipeName ? ["ignore", "ignore", "pipe"] : ["ignore", "ignore", "pipe", "pipe"] });
  let ipc = child.stdio[3] as Duplex | undefined;
  let stopped = false, closed = false, paused = true, position = 0, observedAt = performance.now();
  let stderr = "", buffer = "", requestId = 0;
  let resolveLoaded!: () => void, rejectLoaded!: (error: Error) => void;
  let resolveFinished!: () => void, rejectFinished!: (error: Error) => void;
  const loaded = new Promise<void>((resolve, reject) => { resolveLoaded = resolve; rejectLoaded = reject; });
  loaded.catch(() => {});
  const finished = new Promise<void>((resolve, reject) => { resolveFinished = resolve; rejectFinished = reject; });
  // Attach handlers immediately, including errors before the caller gets ready.
  finished.catch(() => {});
  const pending = new Map<number, { resolve(data: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const command = (args: unknown[]) => new Promise<unknown>((resolve, reject) => {
    if (closed || stopped || !ipc) { reject(new Error("Audio playback has stopped")); return; }
    const id = ++requestId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("Audio player did not respond")); }, 3000);
    pending.set(id, { resolve, reject, timer });
    ipc.write(`${JSON.stringify({ command: args, request_id: id })}\n`, error => {
      if (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  });
  const updatePosition = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) { position = value; observedAt = performance.now(); }
  };
  const fail = (error: Error) => { rejectLoaded(error); rejectFinished(error); };
  child.stderr?.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-8192); });
  const attachIPC = () => {
  ipc!.on("error", error => { if (!stopped && !closed) fail(error); });
  ipc!.setEncoding("utf8");
  ipc!.on("data", chunk => {
    buffer += String(chunk);
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      let message: { request_id?: number; error?: string; data?: unknown; event?: string; name?: string; reason?: string };
      try { message = JSON.parse(line); } catch { continue; }
      if (message.event === "file-loaded") resolveLoaded();
      if (pipeName && message.event === "end-file") {
        if (message.reason === "error") fail(new Error(`Audio playback failed: ${message.error || "mpv could not decode the file"}`));
        playback.stop();
      }
      if (message.event === "property-change" && message.name === "time-pos") updatePosition(message.data);
      if (message.request_id !== undefined) {
        const request = pending.get(message.request_id);
        if (request) {
          clearTimeout(request.timer); pending.delete(message.request_id);
          if (message.error === "success") request.resolve(message.data);
          else request.reject(new Error(`Audio player: ${message.error}`));
        }
      }
    }
  });
  };
  if (ipc) attachIPC();
  child.once("error", error => fail(new Error(`Cannot start mpv: ${error.message}. Install it with brew install mpv, or configure VEOBIBLE_SHORTS_MPV.`)));
  child.once("close", code => {
    closed = true;
    const error = new Error(`Audio playback failed: ${stderr.trim() || `exit ${code}`}`);
    rejectLoaded(error);
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
    pending.clear();
    ipc?.destroy();
    if (stopped || code === 0) resolveFinished(); else rejectFinished(error);
  });
  const ramp = async (levels: number[]) => {
    for (const level of levels) {
      if (closed || stopped) return;
      await command(["set_property", "volume", level]);
      await wait(2);
    }
  };
  const playback: PreviewPlayback = {
    finished,
    position: () => Math.max(0, position + (paused || closed ? 0 : (performance.now() - observedAt) / 1000)),
    pause: async () => {
      if (paused || closed || stopped) return;
      await ramp(Array.from({ length: 20 }, (_, index) => 95 - index * 5));
      // Let the short output buffer drain at zero gain before pausing it.
      await wait(40);
      if (closed || stopped) return;
      await command(["set_property", "pause", true]);
      paused = true;
      updatePosition(await command(["get_property", "time-pos"]));
    },
    resume: async () => {
      if (!paused || closed || stopped) return;
      await command(["set_property", "volume", 0]);
      await command(["set_property", "pause", false]);
      observedAt = performance.now(); paused = false;
      await ramp(Array.from({ length: 20 }, (_, index) => (index + 1) * 5));
    },
    stop: () => {
      if (closed || stopped) return;
      stopped = true;
      // Closing the inherited IPC connection tells mpv to exit and release audio.
      ipc?.end();
      child.kill("SIGTERM");
    }
  };
  const startupTimeout = setTimeout(() => rejectLoaded(new Error("mpv did not load the preview audio")), 10000);
  try {
    if (pipeName) {
      // Windows uses named pipes; inherited POSIX descriptors are not supported.
      const deadline = performance.now() + 3000;
      while (!ipc) {
        try {
          ipc = await new Promise<Duplex>((resolve, reject) => {
            const socket = createConnection(pipeName);
            socket.once("connect", () => { socket.removeListener("error", onError); resolve(socket); });
            const onError = (error: Error) => { socket.destroy(); reject(error); };
            socket.once("error", onError);
          });
        } catch (error) {
          if (closed || performance.now() >= deadline) throw error;
          await wait(25);
        }
      }
      attachIPC();
      await command(["loadfile", file]);
    }
    await loaded;
    await command(["observe_property", 1, "time-pos"]);
    await playback.resume();
    return playback;
  } catch (error) { playback.stop(); throw error; }
  finally { clearTimeout(startupTimeout); }
}
