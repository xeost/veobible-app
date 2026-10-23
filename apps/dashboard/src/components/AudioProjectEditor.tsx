"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Settings,
  ChevronsDown,
  ChevronsUp,
  LoaderCircle,
  Save,
  Combine,
} from "lucide-react";
import type {
  AudioProjectDetail,
  AudioSettings,
} from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { AudioChapter } from "./AudioChapter";
import { BaseVoiceSelector } from "./BaseVoiceSelector";
import { ProjectEditorHeader } from "./ProjectEditorHeader";
import { useGenerationQueue } from "./GenerationQueueContext";
import { queueChangedEvent } from "../lib/generation-queue";
import { useProjectBreadcrumb } from "./ProjectBreadcrumb";
import { useToast } from "./ToastProvider";
import { pollWhileVisible } from "../lib/visible-polling";
import {
  audioVerseApproval,
  isAudioVerseApproved,
} from "../../../../tools/video-project-api/src/audio-approvals";
export function AudioProjectEditor({
  edition,
  book,
}: {
  edition: string;
  book: string;
}) {
  const { t } = useI18n(),
    notify = useToast();
  const queue = useGenerationQueue();
  const queueTasks = queue.items.filter(
    (item) =>
      item.kind === "audio" &&
      item.href ===
        `/audios/${encodeURIComponent(edition)}/${encodeURIComponent(book)}` &&
      ["queued", "running"].includes(item.status),
  );
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
  const pending =
      queueTasks.length > 0 ||
      (!!project && ["queued", "running"].includes(project.status)),
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
  const save = async (nextSettings = settings) => {
    if (!project || !nextSettings) return;
    const saved = await api<AudioProjectDetail>(endpoint, {
      method: "PUT",
      body: JSON.stringify({
        revision: project.revision,
        settings: nextSettings,
      }),
    });
    setProject({ ...project, ...saved });
    setSettings(saved.settings);
    setDirty(false);
    dirtyRef.current = false;
  };
  const toggleApproval = async (reference: string) => {
    if (!project || !settings || busyRef.current || pendingRef.current) return;
    const approval = audioVerseApproval(project, settings, reference);
    if (!approval) return;
    const approvals = { ...settings.approvals };
    if (isAudioVerseApproved(project, settings, reference))
      delete approvals[reference];
    else approvals[reference] = approval;
    setBusy(true);
    busyRef.current = true;
    try {
      await save({ ...settings, approvals });
    } catch {
      notify("Could not save the verse approval. Try again.", "error");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };
  const generate = async (
    scope: {
      chapter?: number;
      verse?: number;
      regenerate?: boolean;
      assembleOnly?: boolean;
      voicesOnly?: boolean;
      alignOnly?: boolean;
    } = {},
  ) => {
    if (busyRef.current) return;
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
      window.dispatchEvent(new Event(queueChangedEvent));
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
  const allVoicesReady = project.content.every((chapter) =>
    chapter.verses.every(
      (verse) => project.recordings[`${chapter.chapter}:${verse.verse}`],
    ),
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
          disabled={locked || !allVoicesReady}
          data-tooltip={t("Create all final audios")}
          onClick={() => void generate({ assembleOnly: true })}
        >
          {locked ? (
            <LoaderCircle className="voice-spinner" size={16} />
          ) : (
            <Combine size={16} />
          )}
          {t("Create all final audios")}
        </button>
      </ProjectEditorHeader>
      <div className="project-studio-layout audio-editor">
        <details className="panel project-voice-settings project-configuration">
          <summary>
            <span className="project-configuration-title">
              <Settings size={18} aria-hidden="true" />
              {t("Project configuration")}
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="project-configuration-content">
            <BaseVoiceSelector
              locale={project.version.locale}
              value={settings.baseVoice}
              preset={settings.narrationPreset}
              onPresetChange={(narrationPreset) =>
                change({ ...settings, narrationPreset })
              }
              disabled={locked}
              onChange={(baseVoice) => change({ ...settings, baseVoice })}
            />
            <p className="muted">
              {t(
                "Generate a voice for each verse, then create the final audio to join the saved voices into one file per chapter, applying your cuts and pauses.",
              )}
            </p>
            {dirty && <p className="notice">{t("Unsaved changes")}</p>}
          </div>
        </details>
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
          {project.content.map((chapter) => (
            <AudioChapter
              key={chapter.chapter}
              chapter={chapter}
              project={project}
              settings={settings}
              locked={locked}
              submitting={busy}
              tasks={queueTasks.filter(
                (task) => task.chapter === chapter.chapter,
              )}
              open={expanded.has(chapter.chapter)}
              toggle={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(chapter.chapter)) next.delete(chapter.chapter);
                  else next.add(chapter.chapter);
                  return next;
                })
              }
              change={change}
              generate={generate}
              onToggleApproval={toggleApproval}
              media={media}
              onPlay={(audio) => {
                Object.values(players.current).forEach((other) => {
                  if (other !== audio) other.pause();
                });
                players.current[String(chapter.chapter)] = audio;
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
