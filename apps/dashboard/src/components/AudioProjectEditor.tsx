"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Download,
  LoaderCircle,
  Mic,
  Save,
  WandSparkles,
} from "lucide-react";
import type {
  AudioProjectDetail,
  AudioSettings,
} from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { VoiceWaveform } from "./VoiceWaveform";
import { BaseVoiceSelector } from "./BaseVoiceSelector";
import { ProjectEditorHeader } from "./ProjectEditorHeader";
import { GenerationProgress } from "./GenerationProgress";
import { useProjectBreadcrumb } from "./ProjectBreadcrumb";
import { useToast } from "./ToastProvider";
import { pollWhileVisible } from "../lib/visible-polling";
export function AudioProjectEditor({
  edition,
  book,
}: {
  edition: string;
  book: string;
}) {
  const { t } = useI18n(),
    notify = useToast();
  const endpoint = `audios/${encodeURIComponent(edition)}/${encodeURIComponent(book)}`;
  const [project, setProject] = useState<AudioProjectDetail | null>(null),
    [settings, setSettings] = useState<AudioSettings | null>(null);
  const [expanded, setExpanded] = useState(new Set([1]));
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const dirtyRef = useRef(false),
    busyRef = useRef(false),
    pendingRef = useRef(false);
  const players = useRef<Record<string, HTMLAudioElement>>({});
  const pending = !!project && ["queued", "running"].includes(project.status),
    locked = busy || pending;
  pendingRef.current = pending;
  dirtyRef.current = dirty;
  busyRef.current = busy;
  useProjectBreadcrumb(`/audios/${edition}/${book}`, project?.title);
  const refresh = useCallback(async () => {
    const value = await api<AudioProjectDetail>(endpoint);
    if (!dirtyRef.current && !busyRef.current) {
      setProject(value);
      setSettings(value.settings);
      setError("");
    }
  }, [endpoint]);
  useEffect(
    () =>
      pollWhileVisible(
        async () => {
          try {
            await refresh();
          } catch {
            setError(
              "Could not load audio projects. Check that generation is available and try again.",
            );
          }
        },
        () => pendingRef.current,
        2500,
      ),
    [refresh],
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const change = (next: AudioSettings) => {
    setSettings(next);
    setDirty(true);
    dirtyRef.current = true;
  };
  const save = async () => {
    if (!project || !settings) return;
    const saved = await api<AudioProjectDetail>(endpoint, {
      method: "PUT",
      body: JSON.stringify({ revision: project.revision, settings }),
    });
    setProject({ ...project, ...saved });
    setSettings(saved.settings);
    setDirty(false);
    dirtyRef.current = false;
  };
  const generate = async (
    scope: { chapter?: number; verse?: number; regenerate?: boolean } = {},
  ) => {
    if (locked) return;
    setBusy(true);
    busyRef.current = true;
    setError("");
    Object.values(players.current).forEach((player) => player.pause());
    try {
      if (dirtyRef.current) await save();
      await api(`${endpoint}/generate`, {
        method: "POST",
        body: JSON.stringify(scope),
      });
      const value = await api<AudioProjectDetail>(endpoint);
      setProject(value);
      setSettings(value.settings);
    } catch {
      notify(
        "Could not complete the audio request. Check that generation is available and try again.",
        "error",
      );
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };
  const media = (chapter: number, verse?: number, revision = "") =>
    `/api/${endpoint}/media?chapter=${chapter}${verse ? `&verse=${verse}` : ""}&revision=${encodeURIComponent(revision)}`;
  if (!project || !settings)
    return (
      <p
        className={error ? "error" : "empty"}
        role={error ? "alert" : undefined}
      >
        {t(error || "Loading project…")}
        {error && (
          <button
            onClick={() =>
              void refresh()
                .then(() => setError(""))
                .catch(() => {})
            }
          >
            {t("Retry")}
          </button>
        )}
      </p>
    );
  return (
    <>
      <ProjectEditorHeader
        title={project.title}
        version={`${project.version.label} · ${t("Audio version")} ${edition.match(/-v(\d+)$/)?.[1]}`}
        backHref="/audios"
      >
        <button
          disabled={locked || !dirty}
          onClick={async () => {
            setBusy(true);
            busyRef.current = true;
            try {
              await save();
              notify("Changes saved.", "success");
            } catch {
              notify(
                "This audio project changed. Reload it before saving.",
                "error",
              );
            } finally {
              setBusy(false);
              busyRef.current = false;
            }
          }}
        >
          <Save size={16} />
          {t("Save changes")}
        </button>
        <button
          className="primary"
          disabled={locked}
          onClick={() => void generate()}
        >
          {locked ? (
            <LoaderCircle className="voice-spinner" size={16} />
          ) : (
            <WandSparkles size={16} />
          )}
          {t("Generate audios")}
        </button>
      </ProjectEditorHeader>
      <div className="project-studio-layout audio-editor">
        <section className="section-card audio-project-settings">
          <BaseVoiceSelector
            locale={project.version.locale}
            value={settings.baseVoice}
            disabled={locked}
            onChange={(baseVoice) => change({ ...settings, baseVoice })}
          />
          <p className="muted">
            {t(
              "Each verse has its own recording. Generate audios joins the saved verses into one audio file per chapter.",
            )}
          </p>
          {dirty && <p className="notice">{t("Unsaved changes")}</p>}
        </section>
        {pending && (
          <GenerationProgress
            label={t(
              project.status === "queued"
                ? "Waiting to generate audio"
                : "Generating audios",
            )}
            value={project.progress}
          />
        )}
        {project.status === "failed" && (
          <p className="error" role="alert">
            {t(
              "Audio generation could not be completed. Completed verses are saved; try again to continue.",
            )}
          </p>
        )}
        {project.status === "done" && (
          <p className="notice">
            {t("Chapter recordings are ready to use in videos.")}
          </p>
        )}
        <div className="section-stack">
          <div className="sections-toolbar">
            <div>
              <h2>{t("Chapters")}</h2>
              <p className="muted">
                {t(
                  "Regenerate individual verses and adjust their waveform before joining the chapter.",
                )}
              </p>
            </div>
            <div>
              <button
                className="icon-button"
                aria-label={t("Expand all sections")}
                onClick={() =>
                  setExpanded(new Set(project.content.map((c) => c.chapter)))
                }
              >
                <ChevronsDown size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={t("Collapse all sections")}
                onClick={() => setExpanded(new Set())}
              >
                <ChevronsUp size={18} />
              </button>
            </div>
          </div>
          {project.content.map((chapter) => {
            const open = expanded.has(chapter.chapter),
              final = project.chapters[String(chapter.chapter)];
            return (
              <section className="section-card" key={chapter.chapter}>
                <div className="voice-section-heading">
                  <button
                    className="section-heading"
                    aria-expanded={open}
                    aria-controls={`audio-chapter-${chapter.chapter}`}
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(chapter.chapter))
                          next.delete(chapter.chapter);
                        else next.add(chapter.chapter);
                        return next;
                      })
                    }
                  >
                    <span className="section-number">
                      {String(chapter.chapter).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>
                        {t("Chapter")} {chapter.chapter}
                      </strong>
                      <small className="muted">
                        {
                          chapter.verses.filter(
                            (v) =>
                              project.recordings[
                                `${chapter.chapter}:${v.verse}`
                              ],
                          ).length
                        }{" "}
                        / {chapter.verses.length} {t("Verses")}
                      </small>
                    </span>
                    <ChevronDown size={18} className={open ? "expanded" : ""} />
                  </button>
                  <div className="audio-chapter-actions">
                    {final && (
                      <a
                        className="icon-button"
                        href={`${media(chapter.chapter, undefined, final.revision)}&download=1`}
                        aria-label={`${t("Download chapter audio")} ${chapter.chapter}`}
                      >
                        <Download size={17} />
                      </a>
                    )}
                    <button
                      disabled={locked}
                      onClick={() =>
                        void generate({ chapter: chapter.chapter })
                      }
                    >
                      <WandSparkles size={15} />
                      {t("Generate chapter audio")}
                    </button>
                  </div>
                </div>
                {open && (
                  <div
                    className="section-body audio-chapter-body"
                    id={`audio-chapter-${chapter.chapter}`}
                  >
                    {final && (
                      <audio
                        ref={(audio) => {
                          if (audio)
                            players.current[`chapter-${chapter.chapter}`] =
                              audio;
                          else
                            delete players.current[
                              `chapter-${chapter.chapter}`
                            ];
                        }}
                        onPlay={() =>
                          Object.entries(players.current).forEach(
                            ([key, audio]) => {
                              if (key !== `chapter-${chapter.chapter}`)
                                audio.pause();
                            },
                          )
                        }
                        className="audio-chapter-player"
                        controls
                        preload="none"
                        src={media(chapter.chapter, undefined, final.revision)}
                        aria-label={`${t("Chapter")} ${chapter.chapter}`}
                      />
                    )}
                    <div className="audio-chapter-toolbar">
                      <button
                        disabled={locked}
                        onClick={() =>
                          void generate({
                            chapter: chapter.chapter,
                            regenerate: true,
                          })
                        }
                      >
                        <Mic size={15} />
                        {t("Regenerate all reading verses")}
                      </button>
                    </div>
                    {chapter.verses.map((verse) => {
                      const ref = `${chapter.chapter}:${verse.verse}`,
                        recording = project.recordings[ref];
                      const action = (
                        <button
                          className="primary"
                          disabled={locked}
                          onClick={() =>
                            void generate({
                              chapter: chapter.chapter,
                              verse: verse.verse,
                              regenerate: true,
                            })
                          }
                        >
                          <Mic size={15} />
                          {t(
                            recording
                              ? "Regenerate this verse"
                              : "Generate verse audio",
                          )}
                        </button>
                      );
                      return (
                        <article className="audio-verse" key={ref}>
                          <div className="audio-verse-text">
                            <span className="verse-reference">{ref}</span>
                            <p>{verse.text}</p>
                          </div>
                          {recording ? (
                            <VoiceWaveform
                              key={recording.revision}
                              src={media(
                                chapter.chapter,
                                verse.verse,
                                recording.revision,
                              )}
                              resourceKey={`${edition}/${book}/${ref}/${recording.revision}`}
                              onPrepared={() => {}}
                              disabled={locked}
                              expanded={open}
                              trim={settings.trims[ref]}
                              onTrim={(trim) => {
                                const trims = { ...settings.trims };
                                if (trim) trims[ref] = trim;
                                else delete trims[ref];
                                change({ ...settings, trims });
                              }}
                              audioRef={(audio) => {
                                if (audio) players.current[ref] = audio;
                                else delete players.current[ref];
                              }}
                              onPlaybackChange={(playing) => {
                                if (playing)
                                  Object.entries(players.current).forEach(
                                    ([other, audio]) => {
                                      if (other !== ref) audio.pause();
                                    },
                                  );
                              }}
                              onError={() =>
                                notify(
                                  "Could not play the narration. Try again.",
                                  "error",
                                )
                              }
                              generateAction={action}
                            />
                          ) : (
                            action
                          )}
                          <label className="audio-verse-pause">
                            {t("Pause after verse (seconds)")}
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.05}
                              value={settings.pauses[ref] ?? 0.35}
                              disabled={locked}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (
                                  Number.isFinite(value) &&
                                  value >= 0 &&
                                  value <= 10
                                )
                                  change({
                                    ...settings,
                                    pauses: {
                                      ...settings.pauses,
                                      [ref]: value,
                                    },
                                  });
                              }}
                            />
                          </label>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
