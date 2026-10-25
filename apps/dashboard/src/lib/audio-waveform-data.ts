import type { AudioWaveform } from "../../../../tools/video-project-api/src/waveform-format";
export type { AudioWaveform } from "../../../../tools/video-project-api/src/waveform-format";

// Keep a compact amplitude envelope instead of retaining decoded chapter audio.
export function summarizeAudio(
  buffer: Pick<
    AudioBuffer,
    "duration" | "sampleRate" | "length" | "numberOfChannels"
  > & {
    getChannelData: (channel: number) => Float32Array;
  },
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
