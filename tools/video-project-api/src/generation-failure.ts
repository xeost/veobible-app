export function generationFailureReason(error: unknown): "disk_full" | "interrupted" | "generation_failed" {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOSPC|out of space|no space left|disk (?:is )?full/i.test(message)) return "disk_full";
  if (/SIGKILL|SIGTERM/i.test(message)) return "interrupted";
  return "generation_failed";
}
