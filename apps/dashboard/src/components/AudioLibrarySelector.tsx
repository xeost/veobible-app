"use client";
import { useEffect, useState } from "react";
import type { AudioProjectSummary } from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import { api } from "./api";
export function AudioLibrarySelector({
  code,
  locale,
  value,
  disabled,
  onChange,
}: {
  code: string;
  locale: string;
  value?: string;
  disabled: boolean;
  onChange: (value?: string) => void;
}) {
  const { t } = useI18n();
  const [editions, setEditions] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    api<{ projects: AudioProjectSummary[] }>("audios")
      .then((data) => {
        if (live)
          setEditions([
            ...new Set(
              data.projects
                .filter(
                  (p) =>
                    p.version.code === code &&
                    p.version.locale === locale &&
                    Object.keys(p.chapters).length > 0,
                )
                .map((p) => p.edition),
            ),
          ]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code, locale]);
  return (
    <label>
      {t("Chapter audio source")}
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">{t("Original recordings")}</option>
        {value && !editions.includes(value) && (
          <option value={value}>
            {t("Audio version")} {value.match(/-v(\d+)$/)?.[1]}
          </option>
        )}
        {editions.map((edition) => (
          <option key={edition} value={edition}>
            {t("Audio version")} {edition.match(/-v(\d+)$/)?.[1]}
          </option>
        ))}
      </select>
      <small className="muted">
        {t("Changing the audio source resets verse timing adjustments.")}{" "}
        {t(
          "New audio versions become available after generating chapter recordings in Audios.",
        )}
      </small>
    </label>
  );
}
