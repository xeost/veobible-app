import assert from "node:assert/strict";
import { test } from "node:test";
import {
  summarizeAudio,
  waveformPeaks,
  withWaveformSlot,
} from "./audio-waveform";

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
