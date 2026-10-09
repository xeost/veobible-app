"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context";
import { relativeTime } from "../lib/relative-time";
import { date } from "./api";

export function UpdatedAt({ value }: { value: string | null }) {
  const { language } = useI18n();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!value || !Number.isFinite(new Date(value).getTime())) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [value]);
  const relative = now === null ? "" : relativeTime(value, language, now);
  return (
    <span className="project-updated-at">
      <span>{date(value, language)}</span>
      {relative && <small>{relative}</small>}
    </span>
  );
}
