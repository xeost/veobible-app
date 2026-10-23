"use client";
import { Globe } from "lucide-react";
import { useI18n } from "../i18n/context";
import type { LoudnessSettings } from "../lib/loudness-settings";

export function LoudnessSettingsPanel({
  settings,
  onChange,
  disabled,
}: {
  settings: LoudnessSettings;
  onChange: (settings: LoudnessSettings) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="video-loudness-title">
      <div className="social-settings-intro">
        <h2 id="video-loudness-title">{t("Automatic voice volume")}</h2>
        <p className="muted">
          {t(
            "Balance all video voices to the selected loudness for each language. Applies to waveform playback, previews and new video renders, including existing projects.",
          )}
        </p>
      </div>
      <div className="social-settings-grid">
        {(
          [
            ["es", "Spanish"],
            ["en", "English"],
            ["pt", "Portuguese"],
          ] as const
        ).map(([locale, label]) => (
          <fieldset
            key={locale}
            className="panel social-settings-language"
            disabled={disabled}
          >
            <legend>
              <Globe size={17} />
              {t(label)}
              <small>{locale.toUpperCase()}</small>
            </legend>
            <label htmlFor={`loudness-${locale}`}>
              {t("Automatic volume")}
              <select
                id={`loudness-${locale}`}
                value={settings[locale]}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    [locale]: Number(event.target.value) as -14 | -16,
                  })
                }
              >
                <option value={-14}>−14 LUFS</option>
                <option value={-16}>−16 LUFS</option>
              </select>
            </label>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
