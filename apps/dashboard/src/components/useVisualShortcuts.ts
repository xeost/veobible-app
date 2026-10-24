"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useToast } from "./ToastProvider";
import {
  visualShortcutsSchema,
  type VisualShortcutKind,
  type VisualShortcut,
} from "../lib/visual-shortcuts";
import type { VisualElement } from "../../../../tools/video-project-api/src/visual-elements";

export function useVisualShortcuts(kind: VisualShortcutKind) {
  const notify = useToast();
  const [items, setItems] = useState<VisualShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  const endpoint = `settings/visual-shortcuts?kind=${kind}`;
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const result = await api<{ shortcuts: VisualShortcut[] }>(endpoint, {
          signal,
        });
        if (!signal?.aborted)
          setItems(visualShortcutsSchema.parse(result.shortcuts));
      } catch {
        if (!signal?.aborted)
          setError("Could not load shortcuts. Reload the page to try again.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint],
  );
  useEffect(() => {
    setItems([]);
    pending.current = false;
    setBusy(false);
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {
      controller.abort();
      mutation.current?.abort();
    };
  }, [refresh]);
  async function save(name: string, element: VisualElement, id?: string) {
    return mutate(id ? "PUT" : "POST", id, { name, element });
  }
  async function mutate(
    method: "POST" | "PUT" | "DELETE" | "PATCH",
    id?: string,
    body?: unknown,
  ) {
    if (pending.current || loading || error) return false;
    pending.current = true;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true);
    try {
      const result = await api<{ shortcuts: VisualShortcut[] }>(
        `settings/visual-shortcuts${id ? `/${id}` : ""}?kind=${kind}`,
        {
          method,
          signal: controller.signal,
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      if (controller.signal.aborted) return false;
      setItems(visualShortcutsSchema.parse(result.shortcuts));
      notify(
        method === "PATCH"
          ? "Shortcut order saved."
          : method === "DELETE"
            ? "Shortcut removed."
            : "Shortcut saved.",
      );
      return true;
    } catch {
      if (controller.signal.aborted) return false;
      setError("Could not save shortcuts. Reload the page and try again.");
      notify(
        "Could not save shortcuts. Reload the page and try again.",
        "error",
      );
      return false;
    } finally {
      if (!controller.signal.aborted) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return {
    items,
    loading,
    busy,
    error,
    save,
    remove: (id: string) => mutate("DELETE", id),
    move: (id: string, direction: "up" | "down") =>
      mutate("PATCH", id, { direction }),
  };
}
export type VisualShortcutsState = ReturnType<typeof useVisualShortcuts>;
