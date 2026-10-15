"use client";
import { useEffect, useRef } from "react";
import { useGenerationQueue } from "./GenerationQueueContext";
import { currentProjectStorageKey } from "../lib/current-video-projects";
import {
  createHomeRefresh,
  homeQueueKey,
  projectChangedEvent,
} from "../lib/home-updates";

export function useHomeUpdates(
  refresh: (signal: AbortSignal) => Promise<void>,
) {
  const queue = useGenerationQueue();
  const key = homeQueueKey(queue);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const request = useRef<() => void>(() => {});
  useEffect(() => {
    const updates = createHomeRefresh(
      (signal) => refreshRef.current(signal),
      () => !document.hidden,
    );
    const trigger = () => {
      void updates.request();
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === currentProjectStorageKey("short") ||
        event.key === currentProjectStorageKey("long")
      )
        trigger();
    };
    request.current = trigger;
    window.addEventListener("focus", trigger);
    window.addEventListener("storage", onStorage);
    window.addEventListener(projectChangedEvent, trigger);
    document.addEventListener("visibilitychange", trigger);
    // Also discover edits from other windows and retry a temporary connection failure.
    const timer = setInterval(trigger, 60000);
    return () => {
      updates.stop();
      request.current = () => {};
      clearInterval(timer);
      window.removeEventListener("focus", trigger);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(projectChangedEvent, trigger);
      document.removeEventListener("visibilitychange", trigger);
    };
  }, []);
  useEffect(() => {
    request.current();
  }, [key]);
}
