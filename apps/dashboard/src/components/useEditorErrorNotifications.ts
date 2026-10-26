"use client";
import { useEffect, useRef } from "react";
import {
  changedEditorErrors,
  type EditorErrors,
} from "../lib/editor-error-notifications";
import { useToast } from "./ToastProvider";

export function useEditorErrorNotifications(
  scope: string,
  errors: EditorErrors,
) {
  const notify = useToast();
  const previous = useRef<{ scope: string; errors: EditorErrors }>({
    scope,
    errors: {},
  });
  useEffect(() => {
    const before =
      previous.current.scope === scope ? previous.current.errors : {};
    previous.current = { scope, errors };
    for (const message of changedEditorErrors(before, errors))
      notify(message, "error");
  }, [scope, errors, notify]);
}
