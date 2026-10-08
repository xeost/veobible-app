"use client";
import { useEffect, useState } from "react";

type VersionIdentity = { locale: string; code: string };
const storageKey = "veo-pinned-bible-versions";
const changedEvent = "bible-version-pins-changed";
// Language and code remain stable when databases are rebuilt or versions are renamed.
const versionPinKey = (version: VersionIdentity) =>
  `${version.locale}:${version.code}`;
function parsePins(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter((key): key is string => typeof key === "string"),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

export function usePinnedBibleVersions() {
  const [pins, setPins] = useState<string[]>([]);
  useEffect(() => {
    const read = () => {
      try {
        setPins(parsePins(localStorage.getItem(storageKey)));
      } catch {
        // Pins still work for this visit if browser storage is unavailable.
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) read();
    };
    const onChange = (event: Event) => {
      setPins(
        parsePins(JSON.stringify((event as CustomEvent<string[]>).detail)),
      );
    };
    read();
    window.addEventListener("storage", onStorage);
    window.addEventListener(changedEvent, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(changedEvent, onChange);
    };
  }, []);
  const positions = new Map(pins.map((key, index) => [key, index]));
  const isPinned = (version: VersionIdentity) =>
    positions.has(versionPinKey(version));
  const orderVersions = <T extends VersionIdentity>(versions: T[]) =>
    [...versions].sort(
      (a, b) =>
        (positions.get(versionPinKey(a)) ?? positions.size) -
        (positions.get(versionPinKey(b)) ?? positions.size),
    );
  const togglePin = (version: VersionIdentity) => {
    const key = versionPinKey(version);
    const next = isPinned(version)
      ? pins.filter((value) => value !== key)
      : [...pins, key];
    setPins(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Preserve the current selection even when persistence is blocked.
    }
    window.dispatchEvent(new CustomEvent(changedEvent, { detail: next }));
  };
  return { isPinned, orderVersions, togglePin };
}
