import { test } from "node:test";
import assert from "node:assert/strict";
import { ProcessTasks, type TaskArgs } from "./process-tasks.js";

const input = {} as TaskArgs["render"][0];
test("CPU-bound tasks leave the parent responsive and preserve progress, failures and recovery", { timeout: 15_000 }, async () => {
  const tasks = new ProcessTasks(new URL("./test-fixtures/task-process.mjs", import.meta.url));
  try {
    let started!: () => void;
    const progress = new Promise<void>((resolve) => { started = resolve; });
    let finished = false;
    const render = tasks.run("render", [input], (stage, percent) => {
      assert.equal(stage, "Rendering");
      assert.equal(percent, 25);
      started();
    }).then((result) => { finished = true; return result; });
    await progress;
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(finished, false, "parent timers run while child is CPU-bound");
    assert.deepEqual(await render, { ok: true });
    assert.deepEqual(await Promise.all(Array.from({ length: 20 }, () => tasks.run("inspection", [input]))), Array.from({ length: 20 }, () => ({ ok: true })));
    await assert.rejects(tasks.run("voice", [input, "intro"]), /VOICE_RESOURCE_LIMIT/);
    await assert.rejects(tasks.run("alignment", [input]), /Task process exited/);
    assert.deepEqual(await tasks.run("inspection", [input]), { ok: true });
  } finally { tasks.stop(); }
  await assert.rejects(tasks.run("inspection", [input]), /stopped/);
});
