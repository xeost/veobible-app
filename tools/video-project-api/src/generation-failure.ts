export function generationFailureReason(error: unknown): "disk_full" | "resource_limit" | "timeout" | "voice_busy" | "interrupted" | "generation_failed" {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOSPC|out of space|no space left|disk (?:is )?full/i.test(message)) return "disk_full";
  if (/VOICE_RESOURCE_LIMIT|out of memory|can't allocate memory/i.test(message)) return "resource_limit";
  if (/VOICE_TIMEOUT/i.test(message)) return "timeout";
  if (/VOICE_BUSY/i.test(message)) return "voice_busy";
  if (/SIGKILL|SIGTERM/i.test(message)) return "interrupted";
  return "generation_failed";
}
