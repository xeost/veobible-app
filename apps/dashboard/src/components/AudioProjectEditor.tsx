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
import { refreshAudioEditor } from "../lib/audio-editor-refresh";
import { audioReviewLocked } from "../lib/audio-review-lock";
import { AudioChapter } from "./AudioChapter";
import { audioMediaUrl, type AudioMediaAccess } from "../lib/audio-media";
import { BaseVoiceSelector } from "./BaseVoiceSelector";
import type { BaseVoiceDefaults } from "../lib/base-voices";
import type { VoiceStylePresets } from "../lib/voice-style-presets";
import { ProjectEditorHeader } from "./ProjectEditorHeader";
import { EditorPreparation, type PreparationTask } from "./EditorPreparation";
import { audioEditorPreparation } from "../lib/audio-editor-preparation";
import { scrollEditorSectionIntoView } from "../lib/editor-section-scroll";
import { useGenerationQueue } from "./GenerationQueueContext";
import { queueChangedEvent } from "../lib/generation-queue";
import { useProjectBreadcrumb } from "./ProjectBreadcrumb";
import { useToast } from "./ToastProvider";
import { useEditorErrorNotifications } from "./useEditorErrorNotifications";
import { pollWhileVisible } from "../lib/visible-polling";
import {
  audioVerseFragment,
  parseAudioVerseFragment,
  type AudioVerseSelection,
} from "../lib/audio-verse-fragment";
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
  const [mediaAccess, setMediaAccess] = useState<{
    endpoint: string;
    access: AudioMediaAccess;
  } | null>(null);
  const mediaAccessRef = useRef(mediaAccess);
  mediaAccessRef.current = mediaAccess;
  const [project, setProject] = useState<AudioProjectDetail | null>(null),
    [settings, setSettings] = useState<AudioSettings | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [formatDefaults, setFormatDefaults] = useState<{
    baseVoiceDefaults: BaseVoiceDefaults["en"];
    voiceStyleDefaults: VoiceStylePresets;
  } | null>(null);
  const [preparedEditor, setPreparedEditor] = useState<string | null>(null);
  const [selectionRestored, setSelectionRestored] = useState<string | null>(
    null,
  );
  const [preparedWaveforms, setPreparedWaveforms] = useState<
    Record<string, boolean>
  >({});
  const onWaveformPrepared = useCallback((key: string, success: boolean) => {
    setPreparedWaveforms((current) =>
      current[key] === success ? current : { ...current, [key]: success },
    );
  }, []);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeVerse, setActiveVerse] = useState<AudioVerseSelection | null>(
    null,
  );
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const dirtyRef = useRef(false),
    busyRef = useRef(false),
    pendingRef = useRef(false);
  const players = useRef<Record<string, HTMLAudioElement>>({});
  useEffect(() => {
    setProject(null);
    setSettings(null);
    setFormatDefaults(null);
    setPreparedEditor(null);
    setSelectionRestored(null);
    setPreparedWaveforms({});
    setExpanded(new Set());
    setActiveVerse(null);
    setError("");
    setDirty(false);
    dirtyRef.current = false;
    Object.values(players.current).forEach((player) => player.pause());
    players.current = {};
  }, [endpoint]);
  const verseCountsKey = project?.verseCounts.join(",");
  useEffect(() => {
    if (
      !verseCountsKey ||
      project?.edition !== edition ||
      project?.book !== book
    )
      return;
    let frame: number | undefined;
    const restore = (event?: HashChangeEvent) => {
      const selected = parseAudioVerseFragment(
        window.location.hash,
        verseCountsKey.split(",").map(Number),
      );
      setSelectionRestored(endpoint);
      if (!selected) {
        if (frame !== undefined) cancelAnimationFrame(frame);
        if (event && !window.location.hash) {
          setActiveVerse(null);
          setExpanded(new Set());
        }
        return;
      }
      const fragment = audioVerseFragment(selected);
      if (window.location.hash !== fragment) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}${fragment}`,
        );
      }
      Object.values(players.current).forEach((player) => player.pause());
      setActiveVerse(selected);
      setExpanded((current) => new Set([...current, selected.chapter]));
      if (preparedEditor !== endpoint) return;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const section = document.getElementById(
          `audio-chapter-block-${selected.chapter}`,
        );
        if (section) scrollEditorSectionIntoView(section);
      });
    };
    restore();
    window.addEventListener("hashchange", restore);
    return () => {
      window.removeEventListener("hashchange", restore);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [
    verseCountsKey,
    project?.edition,
    project?.book,
    edition,
    book,
    endpoint,
    preparedEditor,
  ]);
  const selectVerse = (selected: AudioVerseSelection) => {
    setActiveVerse(selected);
    const fragment = audioVerseFragment(selected);
    if (window.location.hash !== fragment) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}${fragment}`,
      );
    }
  };
  const clearVerseFragment = () => {
    if (window.location.hash)
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
  };
  const pending =
      queueTasks.length > 0 ||
      (!!project && ["queued", "running"].includes(project.status)),
    locked = busy || pending;
  pendingRef.current = pending;
  dirtyRef.current = dirty;
  busyRef.current = busy;
  useProjectBreadcrumb(`/audios/${edition}/${book}`, project?.title);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const current = projectRef.current;
      const { project: value, extras } = await refreshAudioEditor(
        api,
        endpoint,
        current?.edition === edition && current?.book === book ? current : null,
        signal,
      );
      if (signal?.aborted) return;
      // Progress polling must not replace audio URLs during playback.
      if (extras?.mediaAccess) {
        const access = extras.mediaAccess;
        setMediaAccess((current) =>
          current?.endpoint === endpoint &&
          current.access.expiresAt > Date.now() + 5 * 60_000
            ? current
            : { endpoint, access },
        );
      }
      if (extras?.baseVoiceDefaults && extras.voiceStyleDefaults)
        setFormatDefaults({
          baseVoiceDefaults: extras.baseVoiceDefaults,
          voiceStyleDefaults: extras.voiceStyleDefaults,
        });
      if (!dirtyRef.current && !busyRef.current) {
        if (value && value.revision >= (projectRef.current?.revision ?? 0)) {
          projectRef.current = value;
          setProject(value);
          setSettings(value.settings);
        }
        setError("");
      }
    },
    [endpoint, edition, book],
  );
  useEffect(() => {
    const controller = new AbortController();
    const stop = pollWhileVisible(
      async () => {
        try {
          await refresh(controller.signal);
        } catch (error) {
          if (controller.signal.aborted) return;
          setError(
            "Could not load audio projects. Check that generation is available and try again.",
          );
          throw error;
        }
      },
      () => pendingRef.current,
      2500,
    );
    return () => {
      controller.abort();
      stop();
    };
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    const stop = pollWhileVisible(
      async () => {
        const current = mediaAccessRef.current;
        if (
          current?.endpoint !== endpoint ||
          current.access.expiresAt > Date.now() + 5 * 60_000
        )
          return;
        const result = await api<{ mediaAccess: AudioMediaAccess }>(
          `${endpoint}/media-access`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted)
          setMediaAccess({ endpoint, access: result.mediaAccess });
      },
      () => true,
      60_000,
    );
    return () => {
      controller.abort();
      stop();
    };
  }, [endpoint]);
  const currentProject =
    project?.edition === edition && project?.book === book ? project : null;
  const preparation = audioEditorPreparation(
    currentProject,
    expanded,
    activeVerse,
    preparedWaveforms,
  );
  const initialDataLoaded = Boolean(
    currentProject &&
    settings &&
    formatDefaults &&
    selectionRestored === endpoint,
  );
  useEffect(() => {
    if (initialDataLoaded && preparation.completed === preparation.total)
      setPreparedEditor(endpoint);
  }, [initialDataLoaded, preparation.completed, preparation.total, endpoint]);
  const preparing = preparedEditor !== endpoint && !error;
  useEditorErrorNotifications(endpoint, {
    request: error,
    generation:
      currentProject?.status === "failed" &&
      "Audio generation could not be completed. Completed verses are saved; try again to continue.",
    preparation:
      preparation.failed &&
      !preparing &&
      "Some waveforms could not be prepared. Open the chapter to retry loading its audio.",
  });
  const preparationTasks: PreparationTask[] = [
    {
      label: "Project and saved settings",
      status:
        currentProject && settings && formatDefaults
          ? "Completed"
          : "In progress",
    },
    {
      label: "Chapters and verse text",
      status: currentProject ? "Completed" : "Waiting",
    },
    {
      label: "Recordings and saved cuts",
      status: currentProject && settings ? "Completed" : "Waiting",
    },
    {
      label: "Waveforms for open chapters",
      status: preparation.failed
        ? "Could not complete"
        : !initialDataLoaded
          ? "Waiting"
          : preparation.completed < preparation.total
            ? "In progress"
            : "Completed",
    },
  ];
  const preparationOverlay = preparing ? (
    <EditorPreparation
      description="Loading the project and preparing waveforms for the open chapters."
      tasks={preparationTasks}
      completed={preparation.completed}
      total={preparation.total}
    />
  ) : null;
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
    const updated = { ...project, ...saved };
    projectRef.current = updated;
    setProject(updated);
    setSettings(saved.settings);
    setDirty(false);
    dirtyRef.current = false;
  };
  const toggleApproval = async (reference: string) => {
    if (
      !project ||
      !settings ||
      busyRef.current ||
      audioReviewLocked(
        Number(reference.split(":")[0]),
        pendingRef.current,
        queueTasks,
      )
    )
      return;
    const approval = audioVerseApproval(project, settings, reference);
    if (!approval) return;
    const approved = !isAudioVerseApproved(project, settings, reference);
    setBusy(true);
    busyRef.current = true;
    try {
      if (dirtyRef.current) await save();
      const saved = await api<AudioProjectDetail>(`${endpoint}/approval`, {
        method: "PUT",
        body: JSON.stringify({ reference, approval, approved }),
      });
      const updated = { ...projectRef.current!, ...saved };
      projectRef.current = updated;
      setProject(updated);
      setSettings(updated.settings);
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
      textOverride?: string;
    } = {},
  ) => {
    if (busyRef.current) return false;
    setBusy(true);
    busyRef.current = true;
    setError("");
    Object.values(players.current).forEach((player) => player.pause());
    let queued = false;
    try {
      if (dirtyRef.current) await save();
      await api(`${endpoint}/generate`, {
        method: "POST",
        body: JSON.stringify(scope),
      });
      queued = true;
      window.dispatchEvent(new Event(queueChangedEvent));
      const { project: value } = await refreshAudioEditor(
        api,
        endpoint,
        projectRef.current,
      );
      if (value) {
        projectRef.current = value;
        setProject(value);
        setSettings(value.settings);
      }
    } catch {
      notify(
        "Could not complete the audio request. Check that generation is available and try again.",
        "error",
      );
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
    return queued;
  };
  const media = (chapter: number, verse?: number, revision = "") => {
    const access =
      mediaAccess?.endpoint === endpoint ? mediaAccess.access : undefined;
    const asset = verse
      ? project?.recordings[`${chapter}:${verse}`]
      : project?.chapters[String(chapter)];
    return access && asset
      ? audioMediaUrl(access, chapter, verse, revision, asset.file)
      : `/api/${endpoint}/media?chapter=${chapter}${verse ? `&verse=${verse}` : ""}&revision=${encodeURIComponent(revision)}`;
  };
  const cleanEditingFiles = async (chapter: number) => {
    if (!project || busyRef.current || pendingRef.current) return false;
    setBusy(true);
    busyRef.current = true;
    Object.values(players.current).forEach((player) => player.pause());
    try {
      if (dirtyRef.current) await save();
      const cleaned = await api<AudioProjectDetail>(
        `${endpoint}/clean-editing-files`,
        {
          method: "POST",
          body: JSON.stringify({
            chapter,
            revision: projectRef.current!.revision,
          }),
        },
      );
      const updated = { ...projectRef.current!, ...cleaned };
      projectRef.current = updated;
      setProject(updated);
      setSettings(updated.settings);
      setDirty(false);
      dirtyRef.current = false;
      notify(
        "Editing audio files deleted. The final chapter audio and verse approvals were kept.",
        "success",
      );
      return true;
    } catch {
      notify(
        "Could not clean editing audio files. Check that the final chapter audio is available and try again.",
        "error",
      );
      return false;
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };
  if (!project || !settings)
    return (
      <>
        {preparationOverlay}
        {error && (
          <div>
            <button
              onClick={async () => {
                setError("");
                try {
                  await refresh();
                } catch {
                  setError(
                    "Could not load audio projects. Check that generation is available and try again.",
                  );
                }
              }}
            >
              {t("Retry")}
            </button>
          </div>
        )}
      </>
    );
  const allVoicesReady = project.content.every((chapter) =>
    chapter.verses.every(
      (verse) => project.recordings[`${chapter.chapter}:${verse.verse}`],
    ),
  );
  return (
    <>
      {preparationOverlay}
      <div inert={preparing} aria-busy={preparing}>
        <ProjectEditorHeader
          eyebrow="AUDIO PROJECT EDITOR"
          showDescription={false}
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
            {queueTasks.some(
              (task) =>
                task.type === "audio-chapter" && task.status === "running",
            ) ? (
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
                inheritFormatSettings
                defaultVoice={formatDefaults?.baseVoiceDefaults.reading}
                defaultPreset={formatDefaults?.voiceStyleDefaults.reading}
                locale={project.version.locale}
                value={settings.inheritBaseVoice ? "" : settings.baseVoice}
                preset={settings.narrationPreset}
                onPresetChange={(narrationPreset) =>
                  change({ ...settings, narrationPreset })
                }
                disabled={locked}
                onChange={(baseVoice) =>
                  change({
                    ...settings,
                    baseVoice: baseVoice || settings.baseVoice,
                    inheritBaseVoice: !baseVoice,
                  })
                }
              />
              <p className="muted">
                {t(
                  "“Default” uses the value configured in the Settings modal on the corresponding format page.",
                )}
              </p>
              <p className="muted">
                {t(
                  "Generate a voice for each verse, then create the final audio to join the saved voices into one file per chapter, applying your cuts and pauses.",
                )}
              </p>
              {dirty && <p className="notice">{t("Unsaved changes")}</p>}
            </div>
          </details>
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
                  onClick={() => {
                    clearVerseFragment();
                    setExpanded(new Set());
                  }}
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
                selectedVerse={
                  activeVerse?.chapter === chapter.chapter
                    ? activeVerse.verse
                    : undefined
                }
                onSelectVerse={(verse) =>
                  selectVerse({ chapter: chapter.chapter, verse })
                }
                onPrepared={onWaveformPrepared}
                locked={locked}
                approvalLocked={
                  busy ||
                  audioReviewLocked(chapter.chapter, pending, queueTasks)
                }
                submitting={busy}
                tasks={queueTasks.filter(
                  (task) => task.chapter === chapter.chapter,
                )}
                open={expanded.has(chapter.chapter)}
                toggle={() => {
                  if (expanded.has(chapter.chapter)) clearVerseFragment();
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(chapter.chapter)) next.delete(chapter.chapter);
                    else next.add(chapter.chapter);
                    return next;
                  });
                }}
                change={change}
                generate={generate}
                cleanEditingFiles={cleanEditingFiles}
                onToggleApproval={toggleApproval}
                media={media}
                originalMedia={(chapter, revision) =>
                  mediaAccess?.endpoint === endpoint
                    ? audioMediaUrl(
                        mediaAccess.access,
                        chapter,
                        undefined,
                        revision,
                        undefined,
                        true,
                      )
                    : `/api/${endpoint}/original-media?chapter=${chapter}&revision=${encodeURIComponent(revision)}`
                }
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
      </div>
    </>
  );
}
