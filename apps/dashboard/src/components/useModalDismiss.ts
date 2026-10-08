"use client";
import {
  useRef,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from "react";

function isOutside(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) {
  if (event.target !== event.currentTarget) return false;
  if (event.currentTarget.tagName !== "DIALOG") return true;
  const bounds = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  );
}

export function useModalDismiss(close: () => void) {
  const startedOutside = useRef(false);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      startedOutside.current = event.button === 0 && isOutside(event);
    },
    onClick(event: MouseEvent<HTMLElement>) {
      const dismiss = startedOutside.current && isOutside(event);
      startedOutside.current = false;
      if (dismiss) close();
    },
    onCancel(event: SyntheticEvent<HTMLElement>) {
      event.preventDefault();
      close();
    },
  };
}
