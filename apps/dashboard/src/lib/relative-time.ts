import type { Language } from "../i18n/context";

export function relativeTime(
  value: string | null,
  language: Language,
  now = Date.now(),
): string {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = (timestamp - now) / 1000;
  const age = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (age < 60) return formatter.format(0, "second");
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [365 * 86400, "year"],
    [30 * 86400, "month"],
    [7 * 86400, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  const [size, unit] = units.find(([size]) => age >= size)!;
  return formatter.format(Math.sign(seconds) * Math.floor(age / size), unit);
}
