"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "./api";
import { useToast } from "./ToastProvider";
import { useI18n } from "../i18n/context";
import {
  defaultLoudnessSettings,
  type LoudnessSettings,
} from "../lib/loudness-settings";

export function LoudnessSettingsPanel() {
  const { t } = useI18n();
  const notify = useToast();
  const [settings, setSettings] = useState<LoudnessSettings>(
    defaultLoudnessSettings,
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<{ settings: LoudnessSettings }>("settings/video-loudness")
      .then((data) => {
        if (live) setSettings(data.settings);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <form
      className="panel"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          const data = await api<{ settings: LoudnessSettings }>(
            "settings/video-loudness",
            { method: "PUT", body: JSON.stringify(settings) },
          );
          setSettings(data.settings);
          notify("Settings saved.");
        } catch {
          notify("Could not save settings. Try again.", "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 id="video-loudness-title">{t("Automatic voice volume")}</h2>
      <p className="muted">
        {t(
          "Balance all video voices to the selected loudness for each language. Applies to waveform playback, previews and new video renders, including existing projects.",
        )}
      </p>
      {failed && (
        <p className="error" role="alert">
          {t("Could not load settings. Reload the page to try again.")}
        </p>
      )}
      {loading ? (
        <p>{t("Loading settings…")}</p>
      ) : (
        <fieldset
          disabled={busy || failed}
          className="social-settings-grid loudness-settings-fields"
          aria-labelledby="video-loudness-title"
        >
          {(
            [
              ["es", "Spanish"],
              ["en", "English"],
              ["pt", "Portuguese"],
            ] as const
          ).map(([locale, label]) => (
            <label key={locale} htmlFor={`loudness-${locale}`}>
              {t(label)}
              <select
                id={`loudness-${locale}`}
                value={settings[locale]}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    [locale]: Number(event.target.value) as -14 | -16,
                  }))
                }
              >
                <option value={-14}>−14 LUFS</option>
                <option value={-16}>−16 LUFS</option>
              </select>
            </label>
          ))}
        </fieldset>
      )}
      <button
        type="submit"
        className="primary"
        disabled={loading || failed || busy}
      >
        <Save size={16} />
        {busy ? t("Saving…") : t("Save changes")}
      </button>
    </form>
  );
}
