export function validateReadingVolume(value: unknown): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 4
  )
    throw new Error("volumeMultiplier must be between 0 and 4");
}
