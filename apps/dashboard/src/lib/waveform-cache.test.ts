import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readWaveformCache,
  writeWaveformCache,
  waveformCacheKey,
} from "./waveform-cache";

test("persistent peaks can be restored without a memory entry and storage stays bounded", async (t) => {
  const stored = new Map<string, Response>();
  const cache = {
    match: async (key: string | Request) =>
      stored.get(String(key instanceof Request ? key.url : key))?.clone(),
    delete: async (key: string | Request) =>
      stored.delete(String(key instanceof Request ? key.url : key)),
    put: async (key: string, response: Response) => {
      stored.set(key, response.clone());
    },
    keys: async () => [...stored.keys()].map((key) => new Request(key)),
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { open: async () => cache },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "caches", original);
    else Reflect.deleteProperty(globalThis, "caches");
  });
  const key = waveformCacheKey(
    "https://media.example/persisted?mediaToken=secret",
    "restored",
  );
  stored.set(
    key,
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { ETag: '"saved"', "Content-Length": "3" },
    }),
  );
  const restored = await readWaveformCache(key);
  assert.equal(restored?.etag, '"saved"');
  assert.deepEqual(new Uint8Array(restored!.bytes), new Uint8Array([1, 2, 3]));
  for (let i = 0; i < 34; i++) {
    await writeWaveformCache(
      waveformCacheKey(`https://media.example/audio-${i}`, `persistent-${i}`),
      {
        etag: `"${i}"`,
        bytes: new Uint8Array([i]).buffer,
      },
    );
  }
  assert.equal(stored.size, 32);
  assert.ok(!stored.has(key));
  assert.ok([...stored.keys()].every((key) => !key.includes("mediaToken")));
  // Quota and permission failures still leave a usable in-memory result.
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      open: async () => {
        throw new Error("Storage unavailable");
      },
    },
  });
  const unavailable = waveformCacheKey(
    "https://media.example/no-storage",
    "unavailable",
  );
  assert.equal(await readWaveformCache(unavailable), undefined);
  await writeWaveformCache(unavailable, {
    etag: '"memory"',
    bytes: new Uint8Array([7]).buffer,
  });
  assert.equal((await readWaveformCache(unavailable))?.etag, '"memory"');
});
