"use client";
import { useToast } from "./ToastProvider";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  narrationModelsSchema,
  narrationModelOptions,
  type NarrationModels,
} from "../lib/narration-models";
export function VoiceGenerationSettings({ onSaved }: { onSaved: () => void }) {
  const notify = useToast();
  const { t } = useI18n();
  const [models, setModels] = useState<NarrationModels | null>(null);
  const [saved, setSaved] = useState<NarrationModels | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("admin-tools/voice-generation", { signal: controller.signal })
      .then((data) => {
        const value = narrationModelsSchema.parse(data.models);
        if (!controller.signal.aborted) {
          setModels(value);
          setSaved(value);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Could not load voice generation settings. Reload the page to try again.",
          );
      });
    return () => controller.abort();
  }, []);
  async function save() {
    if (!models || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await api("admin-tools/voice-generation", {
        method: "PUT",
        body: JSON.stringify(models),
      });
      const value = narrationModelsSchema.parse(response.models);
      setModels(value);
      setSaved(value);
      notify("Voice generation settings saved.");
      onSaved();
    } catch {
      notify("Could not save voice generation settings. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="panel voice-generation-settings"
      aria-labelledby="voice-generation-title"
    >
      <h2 id="voice-generation-title">{t("Voice generation settings")}</h2>
      <p className="muted">
        {t(
          "Choose the narration model for each Bible language. Applies to new voice generations in Short Videos and Long Videos. Multilingual options use V3.",
        )}
      </p>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {!models && !error && (
        <p role="status">{t("Loading voice generation settings…")}</p>
      )}
      {models && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="voice-generation-languages">
            {(["en", "es", "pt"] as const).map((locale) => (
              <fieldset key={locale} disabled={saving}>
                <legend>
                  {t(
                    { en: "English", es: "Spanish", pt: "Portuguese" }[locale],
                  )}
                </legend>
                <label htmlFor={`narration-model-${locale}`}>
                  {t("Voice model")}
                </label>
                <select
                  id={`narration-model-${locale}`}
                  value={models[locale]}
                  onChange={(event) => {
                    setModels(
                      narrationModelsSchema.parse({
                        ...models,
                        [locale]: event.target.value,
                      }),
                    );
                  }}
                >
                  {narrationModelOptions[locale].map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
                </select>
              </fieldset>
            ))}
          </div>
          <button
            className="primary"
            type="submit"
            disabled={
              saving || JSON.stringify(models) === JSON.stringify(saved)
            }
          >
            {t(saving ? "Saving…" : "Save changes")}
          </button>
        </form>
      )}
    </section>
  );
}
