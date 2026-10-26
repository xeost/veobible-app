import assert from "node:assert/strict";
import { test } from "node:test";
import {
  summarizeAudio,
  waveformPeaks,
  withWaveformSlot,
  loadAudioWaveform,
} from "./audio-waveform";
import {
  encodeWaveform,
  waveformContentType,
} from "../../../../tools/video-project-api/src/waveform-format";
import {
  waveformCacheKey,
  writeWaveformCache,
  readWaveformCache,
} from "./waveform-cache";

test("waveforms retain peaks from all channels and release full audio samples", () => {
  const channels = [
    new Float32Array([0, -0.5, 0, 0, 0.2, 0, 0, 0]),
    new Float32Array([0, 0, 0, 0.8, 0, 0, -0.4, 0]),
  ];
  const data = summarizeAudio({
    duration: 0.004,
    sampleRate: 2000,
    length: 8,
    numberOfChannels: 2,
    getChannelData: (index) => channels[index],
  });
  assert.equal(data.interval, 0.001);
  assert.equal(data.amplitudes.length, 4);
  const peaks = waveformPeaks(data, 0, 0.004, 4);
  assert.ok(Math.abs(peaks[0] - 0.625) < 0.00001);
  assert.equal(peaks[1], 1);
  assert.ok(Math.abs(peaks[3] - 0.5) < 0.00001);
  channels[0].fill(0);
  assert.ok(data.amplitudes[0] > 0);
});

test("reading windows use source timestamps and normalize the visible range", () => {
  const data = {
    duration: 6,
    interval: 1,
    amplitudes: new Float32Array([1, 1, 0.2, 0.4, 1, 1]),
  };
  assert.deepEqual(waveformPeaks(data, 2, 2, 2), [0.5, 1]);
  assert.deepEqual(waveformPeaks(data, 6, 2, 2), [0, 0]);
  assert.deepEqual(
    waveformPeaks({ ...data, amplitudes: new Float32Array(6) }, 0, 6, 3),
    [0, 0, 0],
  );
});

test("preparation limits concurrency and canceled queued work never starts", async () => {
  const controller = new AbortController();
  let running = 0;
  let maximum = 0;
  const release: Array<() => void> = [];
  const work = () =>
    withWaveformSlot(new AbortController().signal, async () => {
      running++;
      maximum = Math.max(maximum, running);
      await new Promise<void>((resolve) => release.push(resolve));
      running--;
    });
  const first = work();
  const second = work();
  let canceledWorkStarted = false;
  const canceled = withWaveformSlot(controller.signal, async () => {
    canceledWorkStarted = true;
  });
  const rejection = assert.rejects(canceled, { name: "AbortError" });
  controller.abort();
  await rejection;
  const third = work();
  assert.equal(release.length, 2);
  release[0]();
  await first;
  assert.equal(release.length, 3);
  release[1]();
  release[2]();
  await Promise.all([second, third]);
  assert.equal(maximum, 2);
  assert.equal(canceledWorkStarted, false);
});

test("failed preparations release their slot and a pre-aborted request does no work", async () => {
  const controller = new AbortController();
  controller.abort();
  let started = false;
  await assert.rejects(
    withWaveformSlot(controller.signal, async () => {
      started = true;
    }),
    { name: "AbortError" },
  );
  assert.equal(started, false);
  await assert.rejects(
    withWaveformSlot(new AbortController().signal, async () => {
      throw new Error("decode failed");
    }),
    /decode failed/,
  );
  assert.deepEqual(
    await Promise.all(
      [1, 2, 3].map((value) =>
        withWaveformSlot(new AbortController().signal, async () => value),
      ),
    ),
    [1, 2, 3],
  );
});

test("compact peaks are cached, revalidated across signed URL refreshes, and replaced after regeneration", async (t) => {
  const bytes = encodeWaveform({
    duration: 0.002,
    interval: 0.001,
    amplitudes: new Float32Array([0.25, 0.75]),
  });
  const src =
    "https://media.example/v1/projects/1/media/intro?kind=short&mediaToken=first";
  let requests = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(input).includes("waveform=1"));
      const etag = new Headers(init?.headers).get("If-None-Match");
      requests++;
      if (requests === 1) assert.equal(etag, null);
      if (requests === 2 || requests === 3) assert.equal(etag, '"v1"');
      if (requests === 2) return new Response(null, { status: 304 });
      return new Response(bytes.slice(0), {
        headers: {
          "Content-Type": waveformContentType,
          ETag: requests > 2 ? '"v2"' : '"v1"',
        },
      });
    },
  );
  const first = await loadAudioWaveform(src, new AbortController().signal, {
    resourceKey: "intro",
  });
  const renewed = src.replace("mediaToken=first", "mediaToken=renewed");
  assert.equal(
    waveformCacheKey(src, "intro"),
    waveformCacheKey(renewed, "intro"),
  );
  assert.ok(!waveformCacheKey(src, "intro").includes("mediaToken"));
  assert.deepEqual(
    await loadAudioWaveform(renewed, new AbortController().signal, {
      resourceKey: "intro",
    }),
    first,
  );
  await loadAudioWaveform(renewed, new AbortController().signal, {
    resourceKey: "intro",
  });
  assert.equal(
    (await readWaveformCache(waveformCacheKey(src, "intro")))?.etag,
    '"v2"',
  );
  await loadAudioWaveform(renewed, new AbortController().signal, {
    resourceKey: "intro",
    refresh: true,
  });
  assert.equal(requests, 4);
});

test("corrupt cached peaks are discarded and unavailable cache storage does not block preparation", async (t) => {
  const src =
    "https://media.example/v1/projects/2/media/intro?mediaToken=private";
  const key = waveformCacheKey(src, "intro");
  await writeWaveformCache(key, {
    bytes: new ArrayBuffer(1),
    etag: '"broken"',
  });
  const bytes = encodeWaveform({
    duration: 0.001,
    interval: 0.001,
    amplitudes: new Float32Array([0.5]),
  });
  t.mock.method(
    globalThis,
    "fetch",
    async (_: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(new Headers(init?.headers).get("If-None-Match"), null);
      return new Response(bytes, {
        headers: { "Content-Type": waveformContentType, ETag: '"fixed"' },
      });
    },
  );
  const result = await loadAudioWaveform(src, new AbortController().signal, {
    resourceKey: "intro",
  });
  assert.equal(result.amplitudes[0], 0.5);
});

test("older services fall back to audio and calculate peaks in a worker", async (t) => {
  const buffer = {
    duration: 0.002,
    sampleRate: 1000,
    length: 2,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array([0.2, -0.8]),
  };
  let closed = false;
  let terminated = false;
  let transferred = false;
  let respond = true;
  let started: (() => void) | undefined;
  class FakeAudioContext {
    decodeAudioData = async () => buffer;
    close = async () => {
      closed = true;
    };
  }
  class FakeWorker {
    onmessage?: (event: { data: ReturnType<typeof summarizeAudio> }) => void;
    postMessage(data: { channels: Float32Array[] }, transfer: ArrayBuffer[]) {
      transferred = transfer[0] === data.channels[0].buffer;
      started?.();
      if (respond)
        queueMicrotask(() =>
          this.onmessage?.({ data: summarizeAudio(buffer) }),
        );
    }
    terminate() {
      terminated = true;
    }
  }
  const originalContext = Object.getOwnPropertyDescriptor(
    globalThis,
    "AudioContext",
  );
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: FakeWorker,
  });
  t.after(() => {
    if (originalContext)
      Object.defineProperty(globalThis, "AudioContext", originalContext);
    else Reflect.deleteProperty(globalThis, "AudioContext");
    if (originalWorker)
      Object.defineProperty(globalThis, "Worker", originalWorker);
    else Reflect.deleteProperty(globalThis, "Worker");
  });
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response(new ArrayBuffer(8), {
      headers: { "Content-Type": "audio/wav" },
    });
  });
  const result = await loadAudioWaveform(
    "https://legacy.example/audio",
    new AbortController().signal,
  );
  assert.equal(requests, 1);
  assert.deepEqual(result, summarizeAudio(buffer));
  assert.ok(transferred && terminated && closed);
  respond = false;
  terminated = false;
  closed = false;
  const controller = new AbortController();
  const workerStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const canceled = loadAudioWaveform(
    "https://legacy.example/audio",
    controller.signal,
  );
  const rejected = assert.rejects(canceled, { name: "AbortError" });
  await workerStarted;
  controller.abort();
  await rejected;
  assert.ok(terminated && closed);
});

test("revisioned verse peaks persist after local decoding and bypass fetching until regeneration or retry", async (t) => {
  const buffer = {
    duration: 0.002,
    sampleRate: 1000,
    length: 2,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array([0.25, -0.75]),
  };
  let decodes = 0;
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: class {
      async decodeAudioData() {
        decodes++;
        return buffer;
      }
      async close() {}
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  });
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response(new ArrayBuffer(8), {
      headers: { "Content-Type": "audio/wav" },
    });
  });
  const src = "https://audio.example/verse?revision=first";
  const options = {
    resourceKey: "edition/book/1:1/first",
    immutableWaveform: true,
  };
  const first = await loadAudioWaveform(
    src,
    new AbortController().signal,
    options,
  );
  const cached = await readWaveformCache(
    waveformCacheKey(src, options.resourceKey),
  );
  assert.ok(cached?.bytes.byteLength);
  assert.deepEqual(
    await loadAudioWaveform(src, new AbortController().signal, options),
    first,
  );
  assert.equal(requests, 1);
  assert.equal(decodes, 1);
  await loadAudioWaveform(
    src.replace("first", "second"),
    new AbortController().signal,
    {
      ...options,
      resourceKey: "edition/book/1:1/second",
    },
  );
  assert.equal(decodes, 2);
  await loadAudioWaveform(src, new AbortController().signal, {
    ...options,
    refresh: true,
  });
  assert.equal(decodes, 3);
  await loadAudioWaveform(src, new AbortController().signal, {
    ...options,
    cacheWaveform: false,
  });
  assert.equal(decodes, 4);
});

test("advancing shares an unfinished prefetch even when the prefetch subscriber leaves", async (t) => {
  const bytes = encodeWaveform({
    duration: 0.001,
    interval: 0.001,
    amplitudes: new Float32Array([0.5]),
  });
  let release!: () => void;
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  let requests = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_: RequestInfo | URL, init?: RequestInit) => {
      requests++;
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      assert.equal(init?.signal?.aborted, false);
      return new Response(bytes, {
        headers: { "Content-Type": waveformContentType, ETag: '"shared"' },
      });
    },
  );
  const src = "https://prefetch.example/verse?revision=one";
  const options = { resourceKey: "next/one", immutableWaveform: true };
  const controller = new AbortController();
  const prefetch = loadAudioWaveform(src, controller.signal, options);
  const canceled = assert.rejects(prefetch, { name: "AbortError" });
  await fetching;
  controller.abort();
  await canceled;
  const visible = loadAudioWaveform(src, new AbortController().signal, options);
  release();
  assert.equal((await visible).amplitudes[0], 0.5);
  assert.equal(requests, 1);
});

test("abandoned speculative loads are canceled and failed loads can be retried", async (t) => {
  const src = "https://prefetch.example/abandoned";
  const options = { resourceKey: "abandoned/one", immutableWaveform: true };
  let started!: () => void;
  let aborted!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  const stopped = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  let requests = 0;
  const bytes = encodeWaveform({
    duration: 0.001,
    interval: 0.001,
    amplitudes: new Float32Array([0.75]),
  });
  t.mock.method(
    globalThis,
    "fetch",
    async (_: RequestInfo | URL, init?: RequestInit) => {
      requests++;
      if (requests === 1) {
        started();
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              aborted();
              reject(init.signal?.reason);
            },
            { once: true },
          );
        });
      }
      return new Response(bytes, {
        headers: { "Content-Type": waveformContentType, ETag: '"retried"' },
      });
    },
  );
  const controller = new AbortController();
  const loading = loadAudioWaveform(src, controller.signal, options);
  const rejected = assert.rejects(loading, { name: "AbortError" });
  await fetching;
  controller.abort();
  await rejected;
  await stopped;
  assert.equal(
    (await loadAudioWaveform(src, new AbortController().signal, options))
      .amplitudes[0],
    0.75,
  );
  assert.equal(requests, 2);
});
