export function now(): string {
  return new Date().toISOString()
}

export function isValidISO(ts: unknown): ts is string {
  if (typeof ts !== 'string' || ts.trim() === '') return false
  return !isNaN(Date.parse(ts))
}
