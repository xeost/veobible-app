import { summarizeAudio, type AudioWaveform } from "./audio-waveform-data";

export type WaveformWorkerInput = {
  channels: Float32Array[];
  duration: number;
  sampleRate: number;
  length: number;
};
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<WaveformWorkerInput>) => void;
  postMessage: (data: AudioWaveform, transfer: Transferable[]) => void;
};
scope.onmessage = ({ data }) => {
  const waveform = summarizeAudio({
    ...data,
    numberOfChannels: data.channels.length,
    getChannelData: (channel) => data.channels[channel],
  });
  scope.postMessage(waveform, [waveform.amplitudes.buffer as ArrayBuffer]);
};
