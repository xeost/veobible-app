"use client";
import { resolveNarrationStyle } from "../lib/narration-parameters";
import {
  builtInNarrationLabels,
  narrationPresetLibrarySchema,
  stylesFromPresetLibrary,
  type NarrationPresetLibrary,
  type NarrationLocale,
  type CustomNarrationPreset,
} from "../lib/narration-style-presets";
import { VoiceSamples } from "./VoiceSamples";
import { NarrationPresetModal } from "./NarrationPresetModal";
import { useToast } from "./ToastProvider";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  narrationModelsSchema,
  narrationModelOptions,
  selectedNarrationDecoder,
  type NarrationModels,
} from "../lib/narration-models";
export function VoiceGenerationSettings() {
  const notify = useToast();
  const { t } = useI18n();
  const [models, setModels] = useState<NarrationModels | null>(null);
  const [saved, setSaved] = useState<NarrationModels | null>(null);
  const [presets, setPresets] = useState<NarrationPresetLibrary | null>(null);
  const [savedPresets, setSavedPresets] =
    useState<NarrationPresetLibrary | null>(null);
  const [editor, setEditor] = useState<{
    locale: NarrationLocale;
    preset: CustomNarrationPreset;
    readOnly: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("admin-tools/voice-generation", { signal: controller.signal })
      .then((data) => {
        const value = narrationModelsSchema.parse(data.models);
        const initialPresets = narrationPresetLibrarySchema.parse(data.presets);
        if (!controller.signal.aborted) {
          setPresets(initialPresets);
          setSavedPresets(initialPresets);
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
    if (!models || !presets || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await api("admin-tools/voice-generation", {
        method: "PUT",
        body: JSON.stringify({
          models,
          styles: stylesFromPresetLibrary(presets),
          presets,
        }),
      });
      const value = narrationModelsSchema.parse(response.models);
      const nextPresets = narrationPresetLibrarySchema.parse(response.presets);
      setPresets(nextPresets);
      setSavedPresets(nextPresets);
      setModels(value);
      setSaved(value);
      notify("Voice generation settings saved.");
    } catch {
      notify("Could not save voice generation settings. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <section
        className="panel voice-generation-settings"
        aria-labelledby="voice-generation-title"
      >
        <h2 id="voice-generation-title">{t("Voice generation settings")}</h2>
        <p className="muted">
          {t(
            "Choose the narration model for each Bible language. Applies to new voices in video and audio projects. Multilingual options use V3.",
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
        {models && presets && (
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
                      { en: "English", es: "Spanish", pt: "Portuguese" }[
                        locale
                      ],
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
                  {locale === "es" && (
                    <details>
                      <summary>
                        {t("Text adaptations for this voice model")}
                      </summary>
                      <label
                        className="checkbox"
                        data-tooltip={t(
                          "Before generating speech, rr becomes rrr, and r or R at the start of a word becomes rr or Rr. Applies only to this Spanish voice model; the original text stays unchanged.",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={
                            models.textAdaptations?.es?.[models.es]
                              ?.reinforceSpanishRs ?? false
                          }
                          onChange={(event) =>
                            setModels(
                              narrationModelsSchema.parse({
                                ...models,
                                textAdaptations: {
                                  ...models.textAdaptations,
                                  es: {
                                    ...models.textAdaptations?.es,
                                    [models.es]: {
                                      ...models.textAdaptations?.es?.[
                                        models.es
                                      ],
                                      reinforceSpanishRs: event.target.checked,
                                    },
                                  },
                                },
                              }),
                            )
                          }
                        />
                        {t("Reinforce the Spanish R sound")}
                      </label>
                    </details>
                  )}
                  <label
                    className="narration-style-label"
                    htmlFor={`narration-style-${locale}`}
                  >
                    {t("Narration style")}
                  </label>
                  <select
                    id={`narration-style-${locale}`}
                    value={presets[locale].selected}
                    onChange={(event) =>
                      setPresets({
                        ...presets,
                        [locale]: {
                          ...presets[locale],
                          selected: event.target.value,
                        },
                      })
                    }
                  >
                    {Object.entries(builtInNarrationLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {t(label)}
                        </option>
                      ),
                    )}
                    {presets[locale].items.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.id === "saved-narration" &&
                        preset.name === "Saved narration"
                          ? t("Saved narration")
                          : preset.name}
                      </option>
                    ))}
                  </select>
                  <div className="narration-preset-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const selected = presets[locale].selected;
                        const builtIn = Object.hasOwn(
                          builtInNarrationLabels,
                          selected,
                        );
                        setEditor({
                          locale,
                          readOnly: builtIn,
                          preset: builtIn
                            ? {
                                id: selected,
                                name: builtInNarrationLabels[
                                  selected as keyof typeof builtInNarrationLabels
                                ],
                                settings: resolveNarrationStyle(
                                  stylesFromPresetLibrary(presets)[locale],
                                ),
                              }
                            : presets[locale].items.find(
                                (preset) => preset.id === selected,
                              )!,
                        });
                      }}
                    >
                      {t(
                        Object.hasOwn(
                          builtInNarrationLabels,
                          presets[locale].selected,
                        )
                          ? "View preset"
                          : "Configure preset",
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          locale,
                          readOnly: false,
                          preset: {
                            id: crypto.randomUUID(),
                            name: "",
                            settings: resolveNarrationStyle(
                              stylesFromPresetLibrary(presets)[locale],
                            ),
                          },
                        })
                      }
                    >
                      {t("Add preset")}
                    </button>
                  </div>
                  <details>
                    <summary>{t("Advanced voice settings")}</summary>
                    <label htmlFor={`audio-decoder-${locale}`}>
                      {t("Audio decoder")}
                    </label>
                    <select
                      id={`audio-decoder-${locale}`}
                      value={selectedNarrationDecoder(models, locale)}
                      onChange={(event) =>
                        setModels(
                          narrationModelsSchema.parse({
                            ...models,
                            decoders: {
                              ...models.decoders,
                              [locale]: {
                                ...models.decoders?.[locale],
                                [models[locale]]: event.target.value,
                              },
                            },
                          }),
                        )
                      }
                    >
                      <option value="general">{t("General (s3gen.pt)")}</option>
                      <option value="v3">{t("V3 (s3gen_v3.pt)")}</option>
                    </select>
                  </details>
                </fieldset>
              ))}
            </div>
            <button
              className="primary"
              type="submit"
              disabled={
                saving ||
                (JSON.stringify(models) === JSON.stringify(saved) &&
                  JSON.stringify(presets) === JSON.stringify(savedPresets))
              }
            >
              {t(saving ? "Saving…" : "Save changes")}
            </button>
          </form>
        )}
        {editor && presets && (
          <NarrationPresetModal
            initial={editor.preset}
            readOnly={editor.readOnly}
            language={
              { en: "English", es: "Spanish", pt: "Portuguese" }[editor.locale]
            }
            close={() => setEditor(null)}
            onDelete={
              !editor.readOnly &&
              presets[editor.locale].items.some(
                (item) => item.id === editor.preset.id,
              )
                ? () => {
                    const current = presets[editor.locale];
                    setPresets({
                      ...presets,
                      [editor.locale]: {
                        selected:
                          current.selected === editor.preset.id
                            ? "natural"
                            : current.selected,
                        items: current.items.filter(
                          (item) => item.id !== editor.preset.id,
                        ),
                      },
                    });
                    setEditor(null);
                    notify("Preset removed. Save changes to keep this change.");
                  }
                : undefined
            }
            apply={(preset) => {
              const current = presets[editor.locale];
              setPresets({
                ...presets,
                [editor.locale]: {
                  selected: preset.id,
                  items: current.items.some((item) => item.id === preset.id)
                    ? current.items.map((item) =>
                        item.id === preset.id ? preset : item,
                      )
                    : [...current.items, preset],
                },
              });
              setEditor(null);
            }}
          />
        )}
      </section>
      <VoiceSamples
        settings={
          models && presets
            ? { models, styles: stylesFromPresetLibrary(presets) }
            : null
        }
        disabled={saving}
      />
    </>
  );
}
