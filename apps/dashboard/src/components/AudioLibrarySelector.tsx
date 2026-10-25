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
  label = "Chapter audio source",
  inheritDefault,
  defaultEdition,
  availableEditions,
  showTimingHelp = true,
}: {
  inheritDefault?: boolean;
  defaultEdition?: string;
  availableEditions?: string[];
  showTimingHelp?: boolean;
  label?: string;
  code: string;
  locale: string;
  value?: string;
  disabled: boolean;
  onChange: (value?: string, inheritDefault?: boolean) => void;
}) {
  const { t } = useI18n();
  const [editions, setEditions] = useState<string[]>([]);
  useEffect(() => {
    if (availableEditions) return;
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
  }, [code, locale, availableEditions]);
  const options = availableEditions ?? editions;
  const editionLabel = (edition?: string) =>
    edition
      ? `${t("Audio version")} ${edition.match(/-v(\d+)$/)?.[1]}`
      : t("Original recordings");
  return (
    <label>
      {t(label)}
      <select
        value={inheritDefault ? "default" : (value ?? "")}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value === "default"
              ? defaultEdition
              : event.target.value || undefined,
            event.target.value === "default",
          )
        }
      >
        {inheritDefault !== undefined && (
          <option value="default">
            {t("Default ({value})").replace(
              "{value}",
              editionLabel(defaultEdition),
            )}
          </option>
        )}
        <option value="">{t("Original recordings")}</option>
        {value && !options.includes(value) && (
          <option value={value}>{editionLabel(value)}</option>
        )}
        {options.map((edition) => (
          <option key={edition} value={edition}>
            {editionLabel(edition)}
          </option>
        ))}
      </select>
      {inheritDefault !== undefined && (
        <small className="muted">
          {t(
            "“Default” uses the value configured in the Settings modal on the corresponding format page.",
          )}
        </small>
      )}
      <small className="muted">
        {showTimingHelp &&
          t("Changing the audio source resets verse timing adjustments.")}{" "}
        {t(
          "New audio versions become available after generating chapter recordings in Audios.",
        )}
      </small>
    </label>
  );
}
