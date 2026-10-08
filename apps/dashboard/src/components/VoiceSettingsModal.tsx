"use client";
import { useModalDismiss } from "./useModalDismiss";
import { useEffect, useRef, useState } from "react";
import { X, Save, Mic } from "lucide-react";
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
export function VoiceSettingsModal({
  kind,
  close,
  canEdit,
}: {
  kind: "short" | "long";
  close: () => void;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const dismiss = useModalDismiss(close);
  const dialog = useRef<HTMLDialogElement>(null);
  const [templates, setTemplates] = useState<VoiceSettings>(emptyVoiceSettings);
  const [tab, setTab] = useState<"voice" | "projects">("voice");
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
      api<{ templates: VoiceSettings }>(
        `settings/voice-templates?kind=${kind}`,
      ),
      api<{ settings: ProjectSettings }>(
        `settings/project-settings?kind=${kind}`,
      ),
      api<{
        versions: {
          id: number | null;
          code: string;
          locale: string;
          label: string;
        }[];
      }>("versions"),
    ])
      .then(([voice, projects, catalog]) => {
        if (live) {
          setTemplates(voice.templates);
          setProjectSettings(projects.settings);
          setVersions(catalog.versions);
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
  }, [kind]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
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
              {t(kind === "short" ? "Short Videos" : "Long Videos")}
            </p>
            <h2 id="voice-settings-title">
              <Mic size={22} />
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
            {t("Narration settings")}
          </button>
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
            {t("Project settings")}
          </button>
        </div>
        {tab === "voice" ? (
          <>
            <p className="muted">
              {t(
                "Configure introduction and closing scripts for each language. They will be used in future narration and video generations.",
              )}
            </p>
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
            ).map(([locale, label]) => (
              <section className="voice-settings-language" key={locale}>
                <h3>{t(label)}</h3>
                {tab === "projects"
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
