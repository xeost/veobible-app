import type { Language } from "../i18n/context";

export function relativeTime(
  value: string | null,
  language: Language,
  now = Date.now(),
): string {
  if (!value) return "";
  const updated = new Date(value);
  const current = new Date(now);
  if (
    !Number.isFinite(updated.getTime()) ||
    !Number.isFinite(current.getTime())
  )
    return "";
  // Compare local calendar dates rather than elapsed hours. UTC ordinals avoid
  // the 23/25-hour days introduced by daylight-saving transitions.
  const calendarDay = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const days = calendarDay(updated) - calendarDay(current);
  const formatter = new Intl.RelativeTimeFormat(language, {
    numeric: days === 0 || days === -1 ? "auto" : "always",
  });
  const label = formatter.format(days, "day");
  return label.charAt(0).toLocaleUpperCase(language) + label.slice(1);
}
