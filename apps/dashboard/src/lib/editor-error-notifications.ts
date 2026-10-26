export type EditorErrors = Record<string, string | false | undefined>;

/** Polling may return the same failure repeatedly; notify only new occurrences. */
export function changedEditorErrors(
  previous: EditorErrors,
  current: EditorErrors,
) {
  return [
    ...new Set(
      Object.entries(current)
        .filter(([key, message]) => message && previous[key] !== message)
        .map(([, message]) => message as string),
    ),
  ];
}
