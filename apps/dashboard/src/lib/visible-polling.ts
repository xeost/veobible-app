/** Serialize polling, pause hidden tabs, and back off after failed requests. */
export function pollWhileVisible(
  refresh: () => Promise<void>,
  shouldPoll: () => boolean,
  interval: number,
) {
  let stopped = false;
  let fetching = false;
  let initial = true;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    if (stopped || fetching) return;
    clearTimeout(timer);
    if (!document.hidden && (initial || shouldPoll())) {
      fetching = true;
      try {
        await refresh();
        initial = false;
        failures = 0;
      } catch {
        failures++;
      } finally {
        fetching = false;
      }
    }
    if (!stopped)
      timer = setTimeout(
        run,
        Math.min(120000, interval * 2 ** Math.min(failures, 4)),
      );
  };
  const onVisible = () => {
    if (!document.hidden) void run();
  };
  document.addEventListener("visibilitychange", onVisible);
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
