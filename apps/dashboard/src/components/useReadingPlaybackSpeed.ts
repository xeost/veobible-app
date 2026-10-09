"use client";

import { useEffect, useState } from "react";

const changedEvent = "reading-playback-speed-changed";
export const readingPlaybackSpeeds = [
  0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3,
] as const;
const storageKey = (locale: string) => `veo-reading-playback-speed:${locale}`;
const validSpeed = (value: number) =>
  readingPlaybackSpeeds.some((speed) => speed === value) ? value : 1;

export function useReadingPlaybackSpeed(locale: string) {
  const [preference, setPreference] = useState({ locale, speed: 1 });
  useEffect(() => {
    const read = () => {
      let speed = 1;
      try {
        speed = validSpeed(Number(localStorage.getItem(storageKey(locale))));
      } catch {
        // Listening remains available when browser storage is blocked.
      }
      setPreference({ locale, speed });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(locale) || event.key === null) read();
    };
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ locale: string; speed: number }>)
        .detail;
      if (detail?.locale === locale)
        setPreference({ locale, speed: validSpeed(detail.speed) });
    };
    read();
    window.addEventListener("storage", onStorage);
    window.addEventListener(changedEvent, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(changedEvent, onChange);
    };
  }, [locale]);

  const setPlaybackSpeed = (value: number) => {
    const speed = validSpeed(value);
    setPreference({ locale, speed });
    try {
      localStorage.setItem(storageKey(locale), String(speed));
    } catch {
      // Keep the listening preference for this visit if persistence is blocked.
    }
    window.dispatchEvent(
      new CustomEvent(changedEvent, { detail: { locale, speed } }),
    );
  };
  return {
    playbackSpeed: preference.locale === locale ? preference.speed : 1,
    setPlaybackSpeed,
  };
}
