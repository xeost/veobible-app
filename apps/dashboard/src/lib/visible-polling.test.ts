import { test } from "node:test";
import assert from "node:assert/strict";
import { pollWhileVisible } from "./visible-polling";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

test("polling pauses hidden tabs, serializes requests, skips inactive work and stops on disposal", async (t) => {
  const previous = globalThis.document;
  const document = Object.assign(new EventTarget(), { hidden: true });
  Object.defineProperty(globalThis, "document", {
    value: document,
    configurable: true,
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let active = true;
  let finish: (() => void) | undefined;
  const stop = pollWhileVisible(
    async () => {
      calls++;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
    () => active,
    10000,
  );
  try {
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(calls, 0);
    document.hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    assert.equal(calls, 1);
    document.dispatchEvent(new Event("visibilitychange"));
    t.mock.timers.tick(30000);
    await flush();
    assert.equal(calls, 1);
    finish!();
    await flush();
    active = false;
    t.mock.timers.tick(10000);
    await flush();
    assert.equal(calls, 1);
    active = true;
    t.mock.timers.tick(10000);
    await flush();
    assert.equal(calls, 2);
    stop();
    finish!();
    await flush();
    t.mock.timers.tick(120000);
    await flush();
    assert.equal(calls, 2);
  } finally {
    stop();
    t.mock.timers.reset();
    Object.defineProperty(globalThis, "document", {
      value: previous,
      configurable: true,
    });
  }
});

test("polling backs off after errors instead of retrying at the normal interval", async (t) => {
  const previous = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    value: Object.assign(new EventTarget(), { hidden: false }),
    configurable: true,
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const stop = pollWhileVisible(
    async () => {
      calls++;
      throw new Error("Unavailable");
    },
    () => true,
    10000,
  );
  try {
    await flush();
    assert.equal(calls, 1);
    t.mock.timers.tick(19999);
    await flush();
    assert.equal(calls, 1);
    t.mock.timers.tick(1);
    await flush();
    assert.equal(calls, 2);
    t.mock.timers.tick(39999);
    await flush();
    assert.equal(calls, 2);
    t.mock.timers.tick(1);
    await flush();
    assert.equal(calls, 3);
  } finally {
    stop();
    t.mock.timers.reset();
    Object.defineProperty(globalThis, "document", {
      value: previous,
      configurable: true,
    });
  }
});
