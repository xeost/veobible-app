"use client";

import { useEffect } from "react";

const storageKey = "veo-home-scroll-position";

export function useHomeScrollPosition(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let restoreFrame = 0;
    let restoring = true;
    let lastPosition = { x: window.scrollX, y: window.scrollY };
    let target = lastPosition;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (
        saved &&
        Number.isFinite(saved.x) &&
        saved.x >= 0 &&
        Number.isFinite(saved.y) &&
        saved.y >= 0
      )
        target = saved;
    } catch {
      // Scroll memory is optional when browser storage is unavailable.
    }
    const save = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(lastPosition));
      } catch {
        // Browsing remains available when local storage is blocked.
      }
    };
    const onScroll = () => {
      if (restoring) return;
      lastPosition = { x: window.scrollX, y: window.scrollY };
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          save();
        });
    };
    const cancelRestore = () => {
      if (!restoring) return;
      cancelAnimationFrame(restoreFrame);
      restoring = false;
      onScroll();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        cancelRestore();
    };
    const onPageHide = () => {
      if (!restoring) save();
    };
    // Wait for loaded tables and navigation's initial scroll reset to finish.
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(() => {
        window.scrollTo({ left: target.x, top: target.y, behavior: "instant" });
        restoring = false;
        onScroll();
      });
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", cancelRestore, { passive: true });
    window.addEventListener("touchstart", cancelRestore, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(restoreFrame);
      // Save the last home position rather than another page's reset position.
      if (!restoring) save();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", cancelRestore);
      window.removeEventListener("touchstart", cancelRestore);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [ready]);
}
