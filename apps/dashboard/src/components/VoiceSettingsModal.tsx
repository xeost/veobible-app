"use client";
import { defaultAudioVersePause } from "../lib/audio-settings";
import { BaseVoiceSelector } from "./BaseVoiceSelector";
import {
  emptyVoiceStyleDefaults,
  type VoiceStyleDefaults,
} from "../lib/voice-style-presets";
import {
  defaultBaseVoices,
  voiceRoles,
  roleLabels,
  type BaseVoiceDefaults,
} from "../lib/base-voices";
import { useToast } from "./ToastProvider";
import { useModalDismiss } from "./useModalDismiss";
import { useEffect, useRef, useState } from "react";
import { X, Save, Settings } from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  emptyProjectSettings,
  projectSettingsSchema,
  type ProjectSettings,
} from "../lib/project-settings";
import {
  emptyVoiceSettings,
  voiceSettingsSchema,
  type VoiceSettings,
} from "../lib/voice-settings";
import {
  emptyPublicationSettings,
  publicationSettingsSchema,
  publicationPlatforms,
  type PublicationSettings,
} from "../lib/publication-settings";
const platformLabels = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
};
export function VoiceSettingsModal({
  kind,
  close,
  canEdit,
}: {
  kind: "short" | "long" | "book" | "audio";
  close: () => void;
  canEdit: boolean;
}) {
  const audioOnly = kind === "audio";
  const publicationKind = kind === "audio" ? "book" : kind;
  const notify = useToast();
  const { t } = useI18n();
  const dismiss = useModalDismiss(close);
  const dialog = useRef<HTMLDialogElement>(null);
  const [templates, setTemplates] = useState<VoiceSettings>(emptyVoiceSettings);
  const [tab, setTab] = useState<
    "voice" | "projects" | "publication" | "baseVoices"
  >(audioOnly ? "baseVoices" : "voice");
  const [baseVoiceLocale, setBaseVoiceLocale] = useState<"es" | "en" | "pt">(
    "en",
  );
  const [versePauseSeconds, setVersePauseSeconds] = useState(
    defaultAudioVersePause,
  );
  const [baseVoices, setBaseVoices] =
    useState<BaseVoiceDefaults>(defaultBaseVoices);
  const [stylePresets, setStylePresets] = useState<VoiceStyleDefaults>(
    emptyVoiceStyleDefaults,
  );
  const [publication, setPublication] = useState<PublicationSettings>(() =>
    emptyPublicationSettings(publicationKind),
  );
  const [publicationLocale, setPublicationLocale] = useState<
    "en" | "es" | "pt"
  >("en");
  const [projectSettings, setProjectSettings] =
    useState<ProjectSettings>(emptyProjectSettings);
  const [versions, setVersions] = useState<
    { id: number | null; code: string; locale: string; label: string }[]
  >([]);
  const [loading, setLoading] = useState(true),
    [loadFailed, setLoadFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    Promise.all([
      api<{
        versePauseSeconds?: number;
        defaults: BaseVoiceDefaults;
        stylePresets: VoiceStyleDefaults;
      }>(`settings/base-voices?kind=${kind}`),
      audioOnly
        ? Promise.resolve(null)
        : api<{ templates: PublicationSettings }>(
            `settings/publication-templates?kind=${kind}`,
          ),
      audioOnly
        ? Promise.resolve(null)
        : api<{ templates: VoiceSettings }>(
            `settings/voice-templates?kind=${kind}`,
          ),
      audioOnly
        ? Promise.resolve(null)
        : api<{ settings: ProjectSettings }>(
            `settings/project-settings?kind=${kind}`,
          ),
      audioOnly
        ? Promise.resolve(null)
        : api<{
            versions: {
              id: number | null;
              code: string;
              locale: string;
              label: string;
            }[];
          }>("versions/options"),
    ])
      .then(([voices, publication, voice, projects, catalog]) => {
        if (live) {
          setBaseVoices(voices.defaults);
          setVersePauseSeconds(
            voices.versePauseSeconds ?? defaultAudioVersePause,
          );
          setStylePresets(voices.stylePresets);
          if (publication) setPublication(publication.templates);
          if (voice) setTemplates(voice.templates);
          if (projects) setProjectSettings(projects.settings);
          if (catalog) setVersions(catalog.versions);
        }
      })
      .catch(() => {
        if (live) {
          setLoadFailed(true);
          setError("Could not load settings. Close and reopen Settings.");
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      document.body.style.overflow = overflow;
    };
  }, [kind, audioOnly]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (tab === "baseVoices") {
      setBusy(true);
      setError("");
      try {
        await api(`settings/base-voices?kind=${kind}`, {
          method: "PUT",
          body: JSON.stringify({
            defaults: baseVoices,
            stylePresets,
            ...(audioOnly ? { versePauseSeconds } : {}),
          }),
        });
        notify("Settings saved.");
        close();
      } catch {
        setError("Could not save settings. Try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (tab === "publication") {
      const parsed =
        publicationSettingsSchema(publicationKind).safeParse(publication);
      if (!parsed.success) {
        setError(
          "Check the publication placeholders and use no more than 20000 characters per template.",
        );
        return;
      }
      setBusy(true);
      setError("");
      try {
        await api(`settings/publication-templates?kind=${kind}`, {
          method: "PUT",
          body: JSON.stringify(parsed.data),
        });
        notify("Settings saved.");
        close();
      } catch {
        setError("Could not save publication templates. Try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (tab === "projects") {
      const parsed = projectSettingsSchema.safeParse(projectSettings);
      if (!parsed.success) {
        setError("Reading volume must be between 0 and 4.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        await api(`settings/project-settings?kind=${kind}`, {
          method: "PUT",
          body: JSON.stringify(parsed.data),
        });
        notify("Settings saved.");
        close();
      } catch {
        setError("Could not save settings. Try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const parsed = voiceSettingsSchema.safeParse(templates);
    if (!parsed.success) {
      setError(
        "Check the script placeholders and use no more than 10000 characters per section.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`settings/voice-templates?kind=${kind}`, {
        method: "PUT",
        body: JSON.stringify(parsed.data),
      });
      notify("Settings saved.");
      close();
    } catch {
      setError("Could not save narration scripts. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog voice-settings-dialog"
      aria-labelledby="voice-settings-title"
      {...dismiss}
    >
      <form onSubmit={submit}>
        <div className="generation-queue-heading">
          <div>
            <p className="eyebrow">
              {t(
                kind === "audio"
                  ? "Audios"
                  : kind === "short"
                    ? "Short Videos"
                    : kind === "book"
                      ? "Book Videos"
                      : "Long Videos",
              )}
            </p>
            <h2 id="voice-settings-title">
              <Settings size={22} />
              {t("Settings")}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Close")}
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <div className="tabs profile-tabs" aria-label={t("Settings")}>
          {!audioOnly && (
            <button
              type="button"
              className={tab === "voice" ? "active" : ""}
              aria-pressed={tab === "voice"}
              disabled={busy}
              onClick={() => {
                setTab("voice");
                setError("");
              }}
            >
              {t("Voice templates")}
            </button>
          )}
          <button
            type="button"
            className={tab === "baseVoices" ? "active" : ""}
            aria-pressed={tab === "baseVoices"}
            disabled={busy}
            onClick={() => {
              setTab("baseVoices");
              setError("");
            }}
          >
            {t("Voices")}
          </button>
          {!audioOnly && (
            <>
              <button
                type="button"
                className={tab === "projects" ? "active" : ""}
                aria-pressed={tab === "projects"}
                disabled={busy}
                onClick={() => {
                  setTab("projects");
                  setError("");
                }}
              >
                {t("Reading (original audio)")}
              </button>
              <button
                type="button"
                className={tab === "publication" ? "active" : ""}
                aria-pressed={tab === "publication"}
                disabled={busy}
                onClick={() => {
                  setTab("publication");
                  setError("");
                }}
              >
                {t("Publication templates")}
              </button>
            </>
          )}
        </div>
        {tab === "baseVoices" ? (
          <p className="muted">
            {t(
              "Choose default voices and narration styles for each language. New projects use these choices; existing recordings stay unchanged.",
            )}
          </p>
        ) : tab === "voice" ? (
          <>
            <p className="muted">
              {t(
                "Configure introduction and closing scripts for each language. They will be used in future narration and video generations.",
              )}
            </p>
          </>
        ) : tab === "publication" ? (
          <>
            <p className="muted">
              {t(
                "Write the publication text for each platform and language. These templates will be used the next time a video is generated. Leave a template empty to skip its publication file.",
              )}
            </p>
            <p className="notice">
              {t(
                "Use {title} for the video title, {reference} for the passage reference, {version} for the Bible version, {passage} for all selected verses and {hashtags} for automatic hashtags.",
              )}
            </p>
            {kind === "long" && (
              <p className="notice">
                {t(
                  "Use {passage_url} for a link to the beginning of the passage in its language and Bible version. The link includes the starting verse unless it is verse 1.",
                )}{" "}
                {t(
                  "Use {episode} for the day number saved in this video project. You can add headings to separate the title and description.",
                )}
              </p>
            )}
            <div
              className="tabs profile-tabs"
              aria-label={t("Publication language")}
            >
              {(
                [
                  ["en", "English"],
                  ["es", "Spanish"],
                  ["pt", "Portuguese"],
                ] as const
              ).map(([locale, label]) => (
                <button
                  type="button"
                  key={locale}
                  className={publicationLocale === locale ? "active" : ""}
                  aria-pressed={publicationLocale === locale}
                  disabled={busy}
                  onClick={() => setPublicationLocale(locale)}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">
            {t(
              "Configure reading volume for new projects in each language and version. Existing projects keep their settings.",
            )}
          </p>
        )}
        {tab === "projects" && (
          <p className="notice" id="project-volume-help">
            {t(
              "Minimum: 0×, muted. Original volume: 1× (100%), unchanged. Maximum: 4× (400% of the original level). Values between 0× and 1× reduce volume; values above 1× increase it.",
            )}
          </p>
        )}
        {tab === "voice" && (
          <p className="notice">
            {t(
              "Use {reference} for the passage, {version} for the Bible version, {book} for the book, {start} for the start and {end} for the end.",
            )}
          </p>
        )}
        {!canEdit && (
          <p className="muted">
            {t("Only administrators can change these settings.")}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {loading ? (
          <p className="empty">{t("Loading settings…")}</p>
        ) : tab === "baseVoices" ? (
          <div className="voice-settings-fields">
            {audioOnly && (
              <section className="voice-settings-language">
                <label htmlFor="audio-verse-pause">
                  {t("Pause after verse (seconds)")}
                  <input
                    id="audio-verse-pause"
                    type="number"
                    min={0}
                    max={10}
                    step={0.05}
                    required
                    value={
                      Number.isFinite(versePauseSeconds)
                        ? versePauseSeconds
                        : ""
                    }
                    disabled={busy || loadFailed || !canEdit}
                    aria-describedby="audio-verse-pause-help"
                    onChange={(event) =>
                      setVersePauseSeconds(event.target.valueAsNumber)
                    }
                  />
                </label>
                <p id="audio-verse-pause-help" className="muted">
                  {t(
                    "Applies to every verse in all audio projects and languages the next time chapter audios are generated. Existing recordings stay unchanged.",
                  )}
                </p>
              </section>
            )}
            <div className="tabs profile-tabs" aria-label={t("Voice language")}>
              {(
                [
                  ["en", "English"],
                  ["es", "Spanish"],
                  ["pt", "Portuguese"],
                ] as const
              ).map(([locale, label]) => (
                <button
                  type="button"
                  key={locale}
                  className={baseVoiceLocale === locale ? "active" : ""}
                  aria-pressed={baseVoiceLocale === locale}
                  onClick={() => setBaseVoiceLocale(locale)}
                  disabled={busy}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            {(audioOnly ? (["reading"] as const) : voiceRoles).map((role) => (
              <section
                className="voice-settings-language"
                key={`${baseVoiceLocale}:${role}`}
              >
                {!audioOnly && <h3>{t(roleLabels[role])}</h3>}
                <BaseVoiceSelector
                  label={audioOnly ? roleLabels[role] : "Narration voice"}
                  locale={baseVoiceLocale}
                  value={baseVoices[baseVoiceLocale][role]}
                  preset={stylePresets[baseVoiceLocale][role]}
                  onPresetChange={(preset) =>
                    setStylePresets((current) => ({
                      ...current,
                      [baseVoiceLocale]: {
                        ...current[baseVoiceLocale],
                        [role]: preset,
                      },
                    }))
                  }
                  onChange={(id) =>
                    setBaseVoices((current) => ({
                      ...current,
                      [baseVoiceLocale]: {
                        ...current[baseVoiceLocale],
                        [role]: id,
                      },
                    }))
                  }
                  disabled={busy || loadFailed || !canEdit}
                />
              </section>
            ))}
          </div>
        ) : (
          <fieldset
            disabled={busy || loadFailed || !canEdit}
            className="voice-settings-fields"
          >
            {(
              [
                ["es", "Spanish"],
                ["en", "English"],
                ["pt", "Portuguese"],
              ] as const
            )
              .filter(
                ([locale]) =>
                  tab !== "publication" || locale === publicationLocale,
              )
              .map(([locale, label]) => (
                <section className="voice-settings-language" key={locale}>
                  <h3>{t(label)}</h3>
                  {tab === "publication"
                    ? publicationPlatforms(publicationKind).map((platform) => (
                        <label
                          key={platform}
                          htmlFor={`publication-${locale}-${platform}`}
                        >
                          {platformLabels[platform]}
                          <textarea
                            id={`publication-${locale}-${platform}`}
                            aria-label={`${platformLabels[platform]} · ${t(label)}`}
                            value={publication[locale][platform] ?? ""}
                            maxLength={20000}
                            rows={7}
                            onChange={(event) =>
                              setPublication((current) => ({
                                ...current,
                                [locale]: {
                                  ...current[locale],
                                  [platform]: event.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                      ))
                    : tab === "projects"
                      ? versions
                          .filter((version) => version.locale === locale)
                          .map((version) => (
                            <label
                              key={`${locale}/${version.code}`}
                              htmlFor={`project-volume-${locale}-${version.code}`}
                            >
                              {version.label} · {t("Reading volume")}
                              <div className="volume-control">
                                <input
                                  id={`project-volume-${locale}-${version.code}`}
                                  type="range"
                                  min={0}
                                  max={4}
                                  step={0.1}
                                  aria-describedby="project-volume-help"
                                  onDoubleClick={() =>
                                    setProjectSettings((current) => ({
                                      ...current,
                                      [locale]: {
                                        ...current[locale],
                                        [version.code]: { volumeMultiplier: 1 },
                                      },
                                    }))
                                  }
                                  value={
                                    projectSettings[locale][version.code]
                                      ?.volumeMultiplier ?? 1
                                  }
                                  onChange={(event) =>
                                    setProjectSettings((current) => ({
                                      ...current,
                                      [locale]: {
                                        ...current[locale],
                                        [version.code]: {
                                          volumeMultiplier:
                                            event.target.valueAsNumber,
                                        },
                                      },
                                    }))
                                  }
                                />
                                <output
                                  htmlFor={`project-volume-${locale}-${version.code}`}
                                >
                                  {(
                                    projectSettings[locale][version.code]
                                      ?.volumeMultiplier ?? 1
                                  ).toFixed(2)}
                                  ×
                                </output>
                              </div>
                              <span className="muted">
                                {t("0× · Muted — 1× · Original — 4× · Maximum")}
                              </span>
                            </label>
                          ))
                      : (["intro", "outro"] as const).map((part) => (
                          <label key={part} htmlFor={`voice-${locale}-${part}`}>
                            {part === "intro"
                              ? t("Introduction")
                              : t("Closing")}
                            <textarea
                              id={`voice-${locale}-${part}`}
                              aria-label={`${part === "intro" ? t("Introduction") : t("Closing")} · ${t(label)}`}
                              value={templates[locale][part]}
                              maxLength={10000}
                              rows={4}
                              onChange={(event) =>
                                setTemplates((current) => ({
                                  ...current,
                                  [locale]: {
                                    ...current[locale],
                                    [part]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        ))}
                </section>
              ))}
          </fieldset>
        )}
        <div className="modal-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t("Close")}
          </button>
          {canEdit && (
            <button
              type="submit"
              className="primary"
              disabled={loading || loadFailed || busy}
            >
              <Save size={16} />
              {busy ? t("Saving…") : t("Save changes")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
