export const clampProgress = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

/** Voice providers report stages; local sampling also reports percentages on stderr. */
export function voiceStageProgress(stage: string) {
  if (/converting/i.test(stage)) return 95;
  if (/generating/i.test(stage)) return 20;
  if (/loading/i.test(stage)) return 10;
  return 5;
}
export function samplingProgress(text: string) {
  const matches = [...text.matchAll(/(?:^|[\r\n\s])([\d.]+)%\|/g)];
  if (!matches.length) return undefined;
  return 20 + clampProgress(Number(matches.at(-1)![1])) * 0.7;
}
