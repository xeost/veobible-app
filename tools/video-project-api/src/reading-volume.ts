/** Generated voices retain their own gain, independently of original recording settings. */
export function readingSourceVolume(
  source: { generatedVoice?: boolean },
  originalVolume: number,
) {
  return source.generatedVoice ? 1 : Math.min(originalVolume, 4);
}
