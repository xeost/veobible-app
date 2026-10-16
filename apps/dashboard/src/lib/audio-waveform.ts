// Keep a compact amplitude envelope instead of retaining decoded chapter audio.
export type AudioWaveform = {
  duration: number;
  interval: number;
  amplitudes: Float32Array;
};
export function summarizeAudio(
  buffer: Pick<
    AudioBuffer,
    "duration" | "sampleRate" | "length" | "numberOfChannels" | "getChannelData"
  >,
): AudioWaveform {
  const stride = Math.max(1, Math.floor(buffer.sampleRate / 1000));
  const amplitudes = new Float32Array(Math.ceil(buffer.length / stride));
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) {
      const index = Math.floor(i / stride);
      amplitudes[index] = Math.max(amplitudes[index], Math.abs(samples[i]));
    }
  }
  return {
    duration: buffer.duration,
    interval: stride / buffer.sampleRate,
    amplitudes,
  };
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
export async function loadAudioWaveform(
  src: string,
  signal: AbortSignal,
): Promise<AudioWaveform> {
  return withWaveformSlot(signal, async () => {
    const boundedSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(60_000),
    ]);
    const response = await fetch(src, { signal: boundedSignal });
    if (!response.ok) throw new Error("Audio unavailable");
    const bytes = await response.arrayBuffer();
    boundedSignal.throwIfAborted();
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(bytes);
      boundedSignal.throwIfAborted();
      return summarizeAudio(buffer);
    } finally {
      await context.close();
    }
  });
}
