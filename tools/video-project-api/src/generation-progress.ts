export const clampProgress = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
function speechProgress(stage: string, fraction: number) {
  const fragment = /fragment (\d+)\/(\d+)/i.exec(stage);
  if (fragment) {
    const index = Number(fragment[1]),
      total = Number(fragment[2]);
    if (total > 0 && index > 0 && index <= total)
      return 20 + (70 * (index - 1 + fraction)) / total;
  }
  return 20 + 70 * fraction;
}

/** Voice providers report stages; local sampling also reports percentages on stderr. */
export function voiceStageProgress(stage: string) {
  if (/converting/i.test(stage)) return 95;
  if (/generating/i.test(stage)) return speechProgress(stage, 0);
  if (/loading/i.test(stage)) return 10;
  return 5;
}
export function samplingProgress(text: string, stage = "") {
  const matches = [...text.matchAll(/(?:^|[\r\n\s])([\d.]+)%\|/g)];
  if (!matches.length) return undefined;
  return speechProgress(stage, clampProgress(Number(matches.at(-1)![1])) / 100);
}
