"use client";
import { useEffect, useRef, useState } from "react";
import { loadAudioWaveform, type AudioWaveform } from "../lib/audio-waveform";

export type WaveformPreparation = {
  cacheWaveform?: boolean;
  resourceKey: string;
  onPrepared: (key: string, success: boolean) => void;
};
export function useAudioWaveform(
  src: string,
  { resourceKey, onPrepared, cacheWaveform = true }: WaveformPreparation,
  enabled = true,
) {
  const [data, setData] = useState<AudioWaveform | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const latest = useRef({ src, onPrepared });
  latest.current = { src, onPrepared };
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const controller = new AbortController();
    setData(null);
    setError(false);
    void loadAudioWaveform(latest.current.src, controller.signal, {
      resourceKey,
      cacheWaveform,
      refresh: revision > 0,
    }).then(
      (waveform) => {
        if (!live) return;
        setData(waveform);
        latest.current.onPrepared(resourceKey, true);
      },
      () => {
        if (!live) return;
        setError(true);
        latest.current.onPrepared(resourceKey, false);
      },
    );
    return () => {
      live = false;
      controller.abort();
    };
    // Signed media URLs can refresh without changing the underlying recording.
  }, [resourceKey, revision, enabled, cacheWaveform]);
  return {
    data,
    error,
    setError,
    retry: () => {
      setError(false);
      setRevision((value) => value + 1);
    },
  };
}
