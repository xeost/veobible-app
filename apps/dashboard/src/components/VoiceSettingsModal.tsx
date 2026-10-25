"use client";
import type { AudioProjectSummary } from "../../../../tools/video-project-api/src/audio-project-schema";
import type { BibleVersionOption } from "../lib/bible-versions";
import {
  emptyChapterAudioSettings,
  type ChapterAudioSettings,
} from "../lib/chapter-audio-settings";
import { AudioLibrarySelector } from "./AudioLibrarySelector";
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
  const [chapterAudio, setChapterAudio] = useState<ChapterAudioSettings>(
    emptyChapterAudioSettings,
  );
  const [versions, setVersions] = useState<BibleVersionOption[]>([]);
  const [audioProjects, setAudioProjects] = useState<AudioProjectSummary[]>([]);
  const [templates, setTemplates] = useState<VoiceSettings>(emptyVoiceSettings);
  const [tab, setTab] = useState<
    "voice" | "publication" | "baseVoices" | "chapterAudio"
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
        : api<{ settings: ChapterAudioSettings }>(
            `settings/chapter-audio?kind=${kind}`,
          ),
      audioOnly
        ? Promise.resolve(null)
        : api<{ versions: BibleVersionOption[] }>("versions/options"),
      audioOnly
        ? Promise.resolve(null)
        : api<{ projects: AudioProjectSummary[] }>("audios"),
    ])
      .then(([voices, publication, voice, chapterAudio, versions, audios]) => {
        if (live) {
          setBaseVoices(voices.defaults);
          setVersePauseSeconds(
            voices.versePauseSeconds ?? defaultAudioVersePause,
          );
          setStylePresets(voices.stylePresets);
          if (publication) setPublication(publication.templates);
          if (voice) setTemplates(voice.templates);
          if (chapterAudio) setChapterAudio(chapterAudio.settings);
          if (versions) setVersions(versions.versions);
          if (audios) setAudioProjects(audios.projects);
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
    if (tab === "chapterAudio") {
      setBusy(true);
      setError("");
      try {
        await api(`settings/chapter-audio?kind=${kind}`, {
          method: "PUT",
          body: JSON.stringify(chapterAudio),
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
                className={tab === "chapterAudio" ? "active" : ""}
                aria-pressed={tab === "chapterAudio"}
                disabled={busy}
                onClick={() => {
                  setTab("chapterAudio");
                  setError("");
                }}
              >
                {t("Audio versions")}
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
        {tab === "chapterAudio" && (
          <p className="muted">
            {t(
              "Choose the chapter audio for each Bible version. Projects that select “Default” will use these choices.",
            )}
          </p>
        )}
        {tab === "baseVoices" ? (
          <p className="muted">
            {t(
              "Choose default voices and narration styles for each language. Projects that select “Default” will use these choices.",
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
        ) : null}
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
        ) : tab === "chapterAudio" ? (
          <fieldset
            disabled={busy || loadFailed || !canEdit}
            className="voice-settings-fields"
          >
            {!versions.length && !loadFailed && (
              <p className="empty">
                {t(
                  "There are no versions yet. Add one to start creating projects.",
                )}
              </p>
            )}
            {versions.map((version) => (
              <section className="voice-settings-language" key={version.id}>
                <h3>
                  {version.label} ·{" "}
                  {t(
                    version.locale === "es"
                      ? "Spanish"
                      : version.locale === "pt"
                        ? "Portuguese"
                        : "English",
                  )}
                </h3>
                <AudioLibrarySelector
                  label="Audio version"
                  code={version.code}
                  locale={version.locale}
                  value={chapterAudio[version.locale][version.code]}
                  availableEditions={[
                    ...new Set(
                      audioProjects
                        .filter(
                          (p) =>
                            p.version.code === version.code &&
                            p.version.locale === version.locale &&
                            Object.keys(p.chapters).length > 0,
                        )
                        .map((p) => p.edition),
                    ),
                  ]}
                  disabled={busy || loadFailed || !canEdit}
                  showTimingHelp={false}
                  onChange={(edition) =>
                    setChapterAudio((current) => ({
                      ...current,
                      [version.locale]: {
                        ...current[version.locale],
                        [version.code]: edition ?? "",
                      },
                    }))
                  }
                />
              </section>
            ))}
          </fieldset>
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
                  inheritSystemSettings
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
                    : (["intro", "outro"] as const).map((part) => (
                        <label key={part} htmlFor={`voice-${locale}-${part}`}>
                          {part === "intro" ? t("Introduction") : t("Closing")}
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
