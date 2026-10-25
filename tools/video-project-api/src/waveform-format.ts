/** Shared binary format: magic/version, duration, interval, then little-endian float peaks. */
export type AudioWaveform = {
  duration: number;
  interval: number;
  amplitudes: Float32Array;
};
export const waveformContentType = "application/vnd.veobible.waveform";
const magic = 0x56425731;
const headerSize = 24;

export function encodeWaveform(data: AudioWaveform): ArrayBuffer {
  const bytes = new ArrayBuffer(headerSize + data.amplitudes.length * 4);
  const view = new DataView(bytes);
  view.setUint32(0, magic);
  view.setUint32(4, 1, true);
  view.setFloat64(8, data.duration, true);
  view.setFloat64(16, data.interval, true);
  for (let i = 0; i < data.amplitudes.length; i++)
    view.setFloat32(headerSize + i * 4, data.amplitudes[i], true);
  return bytes;
}

export function decodeWaveform(bytes: ArrayBuffer): AudioWaveform {
  const view = new DataView(bytes);
  if (
    bytes.byteLength < headerSize ||
    (bytes.byteLength - headerSize) % 4 !== 0 ||
    view.getUint32(0) !== magic ||
    view.getUint32(4, true) !== 1
  )
    throw new Error("Invalid waveform format");
  const duration = view.getFloat64(8, true);
  const interval = view.getFloat64(16, true);
  const count = (bytes.byteLength - headerSize) / 4;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(interval) ||
    interval <= 0 ||
    count !== Math.ceil(duration / interval - 1e-7)
  )
    throw new Error("Invalid waveform dimensions");
  const amplitudes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const value = view.getFloat32(headerSize + i * 4, true);
    if (!Number.isFinite(value) || value < 0)
      throw new Error("Invalid waveform amplitude");
    amplitudes[i] = value;
  }
  return { duration, interval, amplitudes };
}
