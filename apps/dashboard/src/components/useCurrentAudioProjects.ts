"use client";
import { useEffect, useState } from "react";
import type { AudioCatalogRow } from "../lib/audio-listing";
import type { CurrentProjects } from "../lib/current-video-projects";
import {
  advanceCurrentAudioProject,
  currentAudioStorageKey,
  parseCurrentAudioProjects,
  toggleCurrentAudioProject,
} from "../lib/current-audio-projects";
import { projectChangedEvent } from "../lib/home-updates";

export function useCurrentAudioProjects() {
  const [marks, setMarks] = useState<CurrentProjects>({});
  useEffect(() => {
    const read = () => {
      try {
        setMarks(
          parseCurrentAudioProjects(
            localStorage.getItem(currentAudioStorageKey),
          ),
        );
      } catch {
        // Browser marks are unavailable when local storage is blocked.
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === currentAudioStorageKey) read();
    };
    read();
    window.addEventListener("storage", onStorage);
    window.addEventListener(projectChangedEvent, read);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(projectChangedEvent, read);
    };
  }, []);
  const toggle = (row: AudioCatalogRow) => {
    const current = parseCurrentAudioProjects(
      localStorage.getItem(currentAudioStorageKey),
    );
    const next = toggleCurrentAudioProject(current, row);
    localStorage.setItem(currentAudioStorageKey, JSON.stringify(next));
    setMarks(next);
    window.dispatchEvent(new Event(projectChangedEvent));
  };
  const advance = (row: AudioCatalogRow, nextRow: AudioCatalogRow) => {
    const current = parseCurrentAudioProjects(
      localStorage.getItem(currentAudioStorageKey),
    );
    const next = advanceCurrentAudioProject(current, row, nextRow);
    if (next === current) return false;
    localStorage.setItem(currentAudioStorageKey, JSON.stringify(next));
    setMarks(next);
    window.dispatchEvent(new Event(projectChangedEvent));
    return true;
  };
  return { marks, toggle, advance };
}
