"use client";
import { CircleHelp } from "lucide-react";
import {
  narrationStylesSchema,
  resolveNarrationStyle,
  narrationControls,
  type NarrationStyles,
} from "../lib/narration-parameters";
import { useToast } from "./ToastProvider";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  narrationModelsSchema,
  narrationModelOptions,
  type NarrationModels,
} from "../lib/narration-models";
const presets = {
  natural: "Natural narration",
  expressive: "Expressive narration",
  relaxed: "Slower voice",
  custom: "Custom",
} as const;
const help = {
  exaggeration:
    "Controls emotional intensity. 0–2: 0.5 is neutral; higher values add expression and may speed up speech. Extreme values can be unstable.",
  cfg_weight:
    "Controls guidance and pacing. 0–1: lower values allow freer, more deliberate speech; higher values strengthen guidance. It is not an exact speed control.",
  temperature:
    "Controls variation between generations. 0.05–5: lower values are more predictable; higher values add variation and may reduce clarity. The usual starting value is 0.8.",
} as const;
export function VoiceGenerationSettings({ onSaved }: { onSaved: () => void }) {
  const notify = useToast();
  const { t } = useI18n();
  const [models, setModels] = useState<NarrationModels | null>(null);
  const [saved, setSaved] = useState<NarrationModels | null>(null);
  const [styles, setStyles] = useState<NarrationStyles | null>(null);
  const [savedStyles, setSavedStyles] = useState<NarrationStyles | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("admin-tools/voice-generation", { signal: controller.signal })
      .then((data) => {
        const value = narrationModelsSchema.parse(data.models);
        const initialStyles = narrationStylesSchema.parse(data.styles);
        if (!controller.signal.aborted) {
          setStyles(initialStyles);
          setSavedStyles(initialStyles);
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
    if (!models || !styles || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await api("admin-tools/voice-generation", {
        method: "PUT",
        body: JSON.stringify({ models, styles }),
      });
      const value = narrationModelsSchema.parse(response.models);
      const nextStyles = narrationStylesSchema.parse(response.styles);
      setStyles(nextStyles);
      setSavedStyles(nextStyles);
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
      {models && styles && (
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
                <label
                  className="narration-style-label"
                  htmlFor={`narration-style-${locale}`}
                >
                  {t("Narration style")}
                </label>
                <select
                  id={`narration-style-${locale}`}
                  value={styles[locale].preset}
                  onChange={(event) => {
                    const preset = event.target.value;
                    const { exaggeration, cfg_weight, temperature } =
                      resolveNarrationStyle(styles[locale]);
                    setStyles(
                      narrationStylesSchema.parse({
                        ...styles,
                        [locale]:
                          preset === "custom"
                            ? { preset, exaggeration, cfg_weight, temperature }
                            : { preset },
                      }),
                    );
                  }}
                >
                  {Object.entries(presets).map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
                {styles[locale].preset === "custom" ? (
                  <div className="narration-controls">
                    {(
                      Object.keys(
                        narrationControls,
                      ) as (keyof typeof narrationControls)[]
                    ).map((parameter) => {
                      const id = `narration-${locale}-${parameter}`;
                      const value = resolveNarrationStyle(styles[locale])[
                        parameter
                      ];
                      return (
                        <div key={parameter}>
                          <div className="narration-control-label">
                            <label htmlFor={id}>{parameter}</label>
                            <button
                              type="button"
                              className="narration-help"
                              aria-label={`${parameter}: ${t("Help")}`}
                              data-tooltip={t(help[parameter])}
                              aria-describedby={`${id}-help`}
                            >
                              <CircleHelp size={15} aria-hidden="true" />
                            </button>
                            <span id={`${id}-help`} className="sr-only">
                              {t(help[parameter])}
                            </span>
                            <output htmlFor={id}>{value.toFixed(2)}</output>
                          </div>
                          <input
                            id={id}
                            type="range"
                            {...narrationControls[parameter]}
                            value={value}
                            onChange={(event) =>
                              setStyles(
                                narrationStylesSchema.parse({
                                  ...styles,
                                  [locale]: {
                                    ...styles[locale],
                                    [parameter]: Number(event.target.value),
                                  },
                                }),
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted narration-preset-values">
                    {Object.entries(resolveNarrationStyle(styles[locale]))
                      .slice(0, 3)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(" · ")}
                  </p>
                )}
                <p className="muted narration-fixed-values">
                  min_p=0.05 · top_p=1 · repetition_penalty=1.2
                </p>
              </fieldset>
            ))}
          </div>
          <button
            className="primary"
            type="submit"
            disabled={
              saving ||
              (JSON.stringify(models) === JSON.stringify(saved) &&
                JSON.stringify(styles) === JSON.stringify(savedStyles))
            }
          >
            {t(saving ? "Saving…" : "Save changes")}
          </button>
        </form>
      )}
    </section>
  );
}
