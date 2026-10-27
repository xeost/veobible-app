// Cancellation can come from another window, so do not rely on instanceof.
export function isPlaybackInterruption(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function hasMediaPlaybackError(media: {
  error: { code: number } | null;
}): boolean {
  // MEDIA_ERR_ABORTED (1) means loading was cancelled, not that audio failed.
  return media.error !== null && media.error.code !== 1;
}
