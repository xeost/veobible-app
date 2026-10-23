import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { render, inspection, generateProjectVoice } from "./pipeline.js";
import type { alignProjectReading } from "./forced-alignment.js";

type Operations = {
  render: typeof render;
  inspection: typeof inspection;
  voice: typeof generateProjectVoice;
  alignment: typeof alignProjectReading;
};
type TaskProgress = {
  render: NonNullable<Parameters<typeof render>[1]>;
  inspection: () => void;
  voice: NonNullable<Parameters<typeof generateProjectVoice>[2]>;
  alignment: NonNullable<Parameters<typeof alignProjectReading>[1]>;
};
export type TaskName = keyof Operations;
export type TaskArgs = {
  render: [Parameters<typeof render>[0]];
  inspection: [Parameters<typeof inspection>[0]];
  voice: [Parameters<typeof generateProjectVoice>[0], Parameters<typeof generateProjectVoice>[1]];
  alignment: [Parameters<typeof alignProjectReading>[0]];
};
export type TaskRequest = { id: number; name: TaskName; args: TaskArgs[TaskName] };
type Reply = { id: number; result?: unknown; progress?: unknown[]; error?: { message: string; stack?: string } };

/** IPC keeps rendering and analysis off the HTTP event loop, with independent process caches. */
export class ProcessTasks {
  private child?: ChildProcess;
  private sequence = 0;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    progress?: (...values: unknown[]) => void;
  }>();
  private stopped = false;
  constructor(private entry = new URL("./task-process.ts", import.meta.url)) {}

  run<K extends TaskName>(
    name: K,
    args: TaskArgs[K],
    progress?: TaskProgress[K],
  ): Promise<Awaited<ReturnType<Operations[K]>>> {
    if (this.stopped) return Promise.reject(new Error("Task process stopped"));
    const child = this.child ?? this.start();
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        progress: progress as ((...values: unknown[]) => void) | undefined,
      });
      child.send({ id, name, args }, (error) => {
        if (!error) return;
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  private start() {
    const child = fork(fileURLToPath(this.entry), [], {
      execArgv: ["--import", "tsx"],
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      detached: process.platform !== "win32",
      serialization: "advanced",
    });
    this.child = child;
    child.on("message", (message: Reply) => {
      const task = this.pending.get(message.id);
      if (!task) return;
      if (message.progress) {
        task.progress?.(...message.progress);
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        const error = new Error(message.error.message);
        error.stack = message.error.stack ?? error.stack;
        task.reject(error);
      } else task.resolve(message.result);
    });
    const fail = (error: Error) => {
      if (this.child !== child) return;
      this.child = undefined;
      this.kill(child);
      for (const task of this.pending.values()) task.reject(error);
      this.pending.clear();
    };
    child.on("error", fail);
    child.on("exit", (code, signal) => fail(new Error(`Task process exited (${signal ?? code})`)));
    return child;
  }

  private kill(child: ChildProcess) {
    try {
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch { /* The process already exited. */ }
  }

  stop() {
    this.stopped = true;
    if (this.child) this.kill(this.child);
    this.child = undefined;
    for (const task of this.pending.values()) task.reject(new Error("Task process stopped"));
    this.pending.clear();
  }
}
