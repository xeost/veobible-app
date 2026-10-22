/** Accept independent editor actions immediately, but serialize their settings writes. */
export function createEditorTaskQueue(
  onChange: (pending: ReadonlySet<string>) => void,
) {
  const pending = new Set<string>();
  let tail = Promise.resolve();
  return {
    get pending() {
      return pending as ReadonlySet<string>;
    },
    enqueue(scopes: string[], action: () => Promise<void>) {
      if (scopes.some((scope) => pending.has(scope))) return;
      for (const scope of scopes) pending.add(scope);
      onChange(new Set(pending));
      const result = tail.then(action).finally(() => {
        for (const scope of scopes) pending.delete(scope);
        onChange(new Set(pending));
      });
      // A failed submission must not prevent later accepted actions from running.
      tail = result.catch(() => {});
      return result;
    },
  };
}
