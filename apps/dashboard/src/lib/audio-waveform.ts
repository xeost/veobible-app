import { summarizeAudio, type AudioWaveform } from "./audio-waveform-data";
import {
  decodeWaveform,
  encodeWaveform,
  waveformContentType,
} from "../../../../tools/video-project-api/src/waveform-format";
import {
  readWaveformCache,
  writeWaveformCache,
  deleteWaveformCache,
  waveformCacheKey,
} from "./waveform-cache";
import type { WaveformWorkerInput } from "./audio-waveform.worker";
export { summarizeAudio, type AudioWaveform } from "./audio-waveform-data";

function measure(stage: string, start: number) {
  performance.measure(`editor-waveform:${stage}`, {
    start,
    end: performance.now(),
  });
}

async function summarizeOffThread(
  buffer: AudioBuffer,
  signal: AbortSignal,
): Promise<AudioWaveform> {
  signal.throwIfAborted();
  if (typeof Worker === "undefined") return summarizeAudio(buffer);
  let worker: Worker;
  try {
    worker = new Worker(
      new URL("./audio-waveform.worker.ts", import.meta.url),
      { type: "module" },
    );
  } catch {
    return summarizeAudio(buffer);
  }
  let abort: (() => void) | undefined;
  try {
    return await new Promise<AudioWaveform>((resolve, reject) => {
      abort = () => {
        worker.terminate();
        reject(signal.reason);
      };
      signal.addEventListener("abort", abort, { once: true });
      worker.onmessage = (event: MessageEvent<AudioWaveform>) => {
        resolve(event.data);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        reject(new Error("Waveform worker failed"));
      };
      worker.onmessageerror = () =>
        reject(new Error("Invalid waveform worker response"));
      const data: WaveformWorkerInput = {
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        length: buffer.length,
        channels: Array.from({ length: buffer.numberOfChannels }, (_, index) =>
          buffer.getChannelData(index).slice(),
        ),
      };
      worker.postMessage(
        data,
        data.channels.map((channel) => channel.buffer as ArrayBuffer),
      );
    });
  } catch (error) {
    signal.throwIfAborted();
    return summarizeAudio(buffer);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
    worker.terminate();
  }
}
export function waveformPeaks(
  data: AudioWaveform,
  start: number,
  duration: number,
  bars: number,
): number[] {
  const values = Array.from({ length: bars }, (_, bar) => {
    const from = Math.max(
      0,
      Math.floor((start + (bar * duration) / bars) / data.interval),
    );
    const to = Math.min(
      data.amplitudes.length,
      Math.ceil((start + ((bar + 1) * duration) / bars) / data.interval),
    );
    let peak = 0;
    for (let i = from; i < to; i++) peak = Math.max(peak, data.amplitudes[i]);
    return peak;
  });
  const maximum = Math.max(0.01, ...values);
  return values.map((value) => value / maximum);
}

// Bound fetch/decode work, including across an editor being replaced on navigation.
let running = 0;
const waiting: Array<() => void> = [];
export async function withWaveformSlot<T>(
  signal: AbortSignal,
  work: () => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  if (running >= 2) {
    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        signal.removeEventListener("abort", cancel);
        running++;
        resolve();
      };
      const cancel = () => {
        const index = waiting.indexOf(ready);
        if (index >= 0) waiting.splice(index, 1);
        reject(signal.reason);
      };
      waiting.push(ready);
      signal.addEventListener("abort", cancel, { once: true });
    });
  } else running++;
  try {
    signal.throwIfAborted();
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}
type WaveformOptions = {
  resourceKey?: string;
  cacheWaveform?: boolean;
  refresh?: boolean;
  // Only for recordings whose resource key changes whenever the audio changes.
  immutableWaveform?: boolean;
};

const pendingWaveforms = new Map<
  string,
  {
    controller: AbortController;
    promise: Promise<AudioWaveform>;
    users: number;
    abortTimer?: ReturnType<typeof setTimeout>;
  }
>();

/** Share speculative preparation with the editor when the user advances mid-load. */
export async function loadAudioWaveform(
  src: string,
  signal: AbortSignal,
  options: WaveformOptions = {},
): Promise<AudioWaveform> {
  signal.throwIfAborted();
  if (
    !options.immutableWaveform ||
    options.refresh ||
    options.cacheWaveform === false
  )
    return prepareAudioWaveform(src, signal, options);
  const key = waveformCacheKey(src, options.resourceKey ?? src.split("?")[0]);
  let entry = pendingWaveforms.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = {
      controller,
      promise: prepareAudioWaveform(src, controller.signal, options),
      users: 0,
    };
    pendingWaveforms.set(key, entry);
    const current = entry;
    void entry.promise
      .finally(() => {
        if (pendingWaveforms.get(key) === current) pendingWaveforms.delete(key);
      })
      .catch(() => {});
  }
  const current = entry;
  clearTimeout(current.abortTimer);
  current.users++;
  return new Promise<AudioWaveform>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    current.promise.then(
      (data) => {
        signal.removeEventListener("abort", abort);
        resolve(data);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  }).finally(() => {
    // Let a newly mounted editor subscribe before canceling abandoned prefetches.
    if (--current.users === 0)
      current.abortTimer = setTimeout(() => {
        if (pendingWaveforms.get(key) === current) pendingWaveforms.delete(key);
        current.controller.abort();
      }, 0);
  });
}

async function prepareAudioWaveform(
  src: string,
  signal: AbortSignal,
  options: WaveformOptions,
): Promise<AudioWaveform> {
  return withWaveformSlot(signal, async () => {
    const boundedSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(60_000),
    ]);
    const key = waveformCacheKey(src, options.resourceKey ?? src.split("?")[0]);
    let cached =
      options.cacheWaveform !== false && !options.refresh
        ? await readWaveformCache(key)
        : undefined;
    let cachedData: AudioWaveform | undefined;
    if (cached) {
      try {
        cachedData = decodeWaveform(cached.bytes);
      } catch {
        await deleteWaveformCache(key);
        cached = undefined;
      }
    }
    if (cachedData && options.immutableWaveform) return cachedData;
    const downloadStart = performance.now();
    let response: Response | undefined;
    try {
      const prepared = await fetch(
        `${src}${src.includes("?") ? "&" : "?"}waveform=1`,
        {
          signal: boundedSignal,
          headers: cached ? { "If-None-Match": cached.etag } : {},
        },
      );
      if (prepared.status === 304 && cachedData) {
        boundedSignal.throwIfAborted();
        measure("revalidate", downloadStart);
        return cachedData;
      }
      if (
        prepared.ok &&
        prepared.headers.get("content-type")?.split(";")[0] ===
          waveformContentType
      ) {
        const bytes = await prepared.arrayBuffer();
        boundedSignal.throwIfAborted();
        measure("download", downloadStart);
        const parseStart = performance.now();
        const waveform = decodeWaveform(bytes);
        measure("read-peaks", parseStart);
        const etag = prepared.headers.get("etag");
        if (etag && options.cacheWaveform !== false)
          void writeWaveformCache(key, { bytes, etag });
        return waveform;
      }
      // Older services may ignore the option and return audio directly.
      if (
        prepared.ok &&
        prepared.headers.get("content-type")?.startsWith("audio/")
      )
        response = prepared;
      else await prepared.body?.cancel();
    } catch {
      boundedSignal.throwIfAborted();
      // A service without precomputed peaks can still prepare existing audio locally.
    }
    response ??= await fetch(src, { signal: boundedSignal });
    if (!response.ok) throw new Error("Audio unavailable");
    const bytes = await response.arrayBuffer();
    boundedSignal.throwIfAborted();
    measure("audio-download", downloadStart);
    const context = new AudioContext();
    try {
      const decodeStart = performance.now();
      const buffer = await context.decodeAudioData(bytes);
      boundedSignal.throwIfAborted();
      measure("audio-decode", decodeStart);
      const computeStart = performance.now();
      const waveform = await summarizeOffThread(buffer, boundedSignal);
      measure("compute-peaks", computeStart);
      if (options.immutableWaveform && options.cacheWaveform !== false)
        await writeWaveformCache(key, {
          bytes: encodeWaveform(waveform),
          etag: '"local-waveform-v1"',
        });
      return waveform;
    } finally {
      await context.close();
    }
  });
}
