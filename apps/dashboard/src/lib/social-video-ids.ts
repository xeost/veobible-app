/** Only IDs found by detection may be used to construct outbound video links. */
export function detectedYouTubeId(
  value: string | null | undefined,
): string | null {
  try {
    const id = JSON.parse(value ?? "{}").youtube;
    return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
