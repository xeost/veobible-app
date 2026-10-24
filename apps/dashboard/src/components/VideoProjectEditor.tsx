"use client";
import { SectionVisualElements } from "./SectionVisualElements";
import type { VisualElement } from "../../../../tools/video-project-api/src/visual-elements";
import { BaseVoiceSelector } from "./BaseVoiceSelector";
import type { VoiceStylePresets } from "../lib/voice-style-presets";
import { AudioLibrarySelector } from "./AudioLibrarySelector";
import {
  projectBaseVoice,
  defaultBaseVoices,
  type BaseVoiceDefaults,
  roleLabels,
  type VoiceLocale,
} from "../lib/base-voices";
import { useToast } from "./ToastProvider";
import {
  alignmentWasApplied,
  alignmentSignatureMatches,
  mergeAlignment,
  type AlignmentJob,
} from "../../../../tools/video-project-api/src/forced-alignment-result";
import type { VoicePart } from "../../../../tools/video-project-api/src/chapter-introductions";
import { pollWhileVisible } from "../lib/visible-polling";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  ChevronLeft,
  ChevronDown,
  Settings,
  ChevronsDown,
  ChevronsUp,
  Mic,
  AudioLines,
  WandSparkles,
  Play,
  Pause,
  LoaderCircle,
  Save,
  AudioWaveform,
  Download,
  Check,
  Clapperboard,
  CircleCheck,
  ScanText,
  UnfoldHorizontal,
  Volume2,
} from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  userMessage,
  generationStage,
  voiceFailureMessage,
} from "../lib/presentation";
import { settingsSchema, type RenderRequest } from "../lib/video-schema";
import { type VideoRow, type VideoKind } from "./video-project";
import {
  adjustedCues,
  verseHasSavedCuts,
  verseHasManualCuts,
  resetManualVerseCuts,
  validVerseTimings,
  readingTimeline,
  type Inspection,
  type VerseCue,
} from "../lib/video-timing";
import { useProjectBreadcrumb } from "./ProjectBreadcrumb";
import { VideoProjectPreviewModal } from "./VideoProjectPreviewModal";
import {
  VideoProjectPreview,
  type VideoPreviewView,
  type PreviewPlaybackHandle,
} from "./VideoProjectPreview";
import { ProjectEditorHeader } from "./ProjectEditorHeader";
import { GenerationProgress } from "./GenerationProgress";
import { expandReadingContext } from "../../../../tools/video-project-api/src/reading-timeline";
import { VoiceWaveform } from "./VoiceWaveform";
import { VerseWaveform } from "./VerseWaveform";
import { queueChangedEvent } from "../lib/generation-queue";
import { editorActivityLocks, editorBlockLocks } from "../lib/editor-activity";
import { createEditorTaskQueue } from "../lib/editor-task-queue";
import {
  parseVideoVerseFragment,
  videoVerseFragment,
  type VideoVerseTarget,
} from "../lib/video-verse-fragment";
type Settings = RenderRequest["settings"];
type EditorProject = VideoRow & { passage: string };
type VoiceState = {
  available: boolean;
  automaticTrim?: { startSeconds: number; endSeconds: number };
  status: string;
  failureReason?: string;
  progress?: number;
  jobId?: string;
};
type Voices = Record<VoicePart, VoiceState>;
const emptyVoices: Voices = {
  intro: { available: false, status: "idle" },
  outro: { available: false, status: "idle" },
};
export function VideoProjectEditor({
  kind,
  projectId,
}: {
  kind: VideoKind;
  projectId: string;
}) {
  const notify = useToast();
  const { t } = useI18n();
  const [project, setProject] = useState<EditorProject | null>(null);
  const [settings, setSettings] = useState<Settings>(settingsSchema.parse({}));
  const [loudnessTarget, setLoudnessTarget] = useState<-14 | -16>(-14);
  const [baseVoiceDefaults, setBaseVoiceDefaults] = useState<
    BaseVoiceDefaults["es"]
  >(defaultBaseVoices().es);
  const [voiceStyleDefaults, setVoiceStyleDefaults] =
    useState<VoiceStylePresets>({});
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [analysis, setAnalysis] = useState<Inspection | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const analysisRequest = useRef(0);
  const [alignmentJobs, setAlignmentJobs] = useState<AlignmentJob[]>([]);
  const [alignmentLoaded, setAlignmentLoaded] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [taskSubmissions] = useState(() =>
    createEditorTaskQueue(setPendingTasks),
  );
  const [applyingAlignment, setApplyingAlignment] =
    useState<AlignmentJob | null>(null);
  const applyingAlignmentRef = useRef(false);
  const alignmentPending = alignmentJobs.some((job) =>
    ["queued", "running"].includes(job.status),
  );
  const needsAlignmentApply = (job: AlignmentJob) =>
    Boolean(
      project &&
      job.status === "done" &&
      job.result &&
      !alignmentWasApplied(settings, job.id) &&
      alignmentSignatureMatches(job.result.signature, {
        kind,
        version: { id: project.version_code, locale: project.locale },
        passage: JSON.parse(project.passage),
        settings,
      }),
    );
  const alignmentAwaitingApply = alignmentJobs.some(needsAlignmentApply);
  const alignmentScopeBusy = (sectionIndex?: number) =>
    pendingTasks.has("alignment") ||
    (sectionIndex === undefined
      ? [...pendingTasks].some((scope) => scope.startsWith("alignment-"))
      : pendingTasks.has(`alignment-${sectionIndex}`)) ||
    alignmentJobs.some(
      (job) =>
        (["queued", "running"].includes(job.status) ||
          needsAlignmentApply(job)) &&
        (sectionIndex === undefined ||
          job.sectionIndex === undefined ||
          job.sectionIndex === sectionIndex),
    );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [error, setError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVoice, setPreviewVoice] = useState<VoicePart | null>(null);
  const [previewReading, setPreviewReading] = useState<{
    references: string[];
    title: string;
    sectionId: string;
  } | null>(null);
  const previewPlayback = useRef<PreviewPlaybackHandle | null>(null);
  const [previewView, setPreviewView] =
    useState<VideoPreviewView>("composition");
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [saved]);
  useEffect(() => {
    setSaved(false);
  }, [settings, projectId]);
  const [voices, setVoices] = useState<Voices>(emptyVoices);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const queuingVoices = pendingTasks.has("voices");
  const [voiceRevision, setVoiceRevision] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeVerse, setActiveVerse] = useState<
    (VideoVerseTarget & { project: string }) | null
  >(null);
  const collapseAnchor = useRef<{ id: string; top: number } | null>(null);
  const collapseSpace = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const anchor = collapseAnchor.current;
    collapseAnchor.current = null;
    if (!anchor) return;
    const heading = document.getElementById(`heading-${anchor.id}`);
    const space = collapseSpace.current;
    if (!heading || !space) return;
    // Keep room to retain the heading's position when collapsing near the page end.
    space.style.height = "0px";
    const target =
      window.scrollY + heading.getBoundingClientRect().top - anchor.top;
    const missing =
      target + window.innerHeight - document.documentElement.scrollHeight;
    space.style.height = `${Math.max(0, missing)}px`;
    window.scrollTo({ top: target, behavior: "instant" });
  }, [expanded]);
  const [readingResetRevisions, setReadingResetRevisions] = useState<
    Record<string, number>
  >({});
  const [playingVoice, setPlayingVoice] = useState<VoicePart | null>(null);
  const voicePlayers = useRef<Partial<Record<VoicePart, HTMLAudioElement>>>({});
  const projectState = useRef(project);
  projectState.current = project;
  const voiceState = useRef(voices);
  voiceState.current = voices;
  const base = `videos/${encodeURIComponent(projectId)}?kind=${kind}`;
  const [preparedWaveforms, setPreparedWaveforms] = useState<
    Record<string, boolean>
  >({});
  const [preparedEditor, setPreparedEditor] = useState<string | null>(null);
  const onWaveformPrepared = useCallback((key: string, success: boolean) => {
    setPreparedWaveforms((current) =>
      current[key] === success ? current : { ...current, [key]: success },
    );
  }, []);

  const endpoint = useCallback(
    (action = "") =>
      `videos/${encodeURIComponent(projectId)}${action ? `/${action}` : ""}?kind=${kind}`,
    [projectId, kind],
  );
  const backHref = `/${kind === "short" ? "short-videos" : kind === "book" ? "book-videos" : "long-videos"}`;
  useProjectBreadcrumb(
    `${backHref}/${encodeURIComponent(projectId)}`,
    String(project?.project_id) === projectId ? project?.title : undefined,
  );
  const [mediaAccess, setMediaAccess] = useState<{
    base: string;
    query: string;
    expiresAt: number;
  } | null>(null);
  const mediaAccessRef = useRef(mediaAccess);
  mediaAccessRef.current = mediaAccess;
  const media = useCallback(
    (asset: string) =>
      mediaAccess
        ? `${mediaAccess.base}${encodeURIComponent(asset)}?${mediaAccess.query}`
        : `/api/${endpoint("media")}&asset=${encodeURIComponent(asset)}`,
    [mediaAccess, endpoint],
  );
  useEffect(() => {
    setMediaAccess(null);
    setPreparedWaveforms({});
    setPreparedEditor(null);
    collapseAnchor.current = null;
    if (collapseSpace.current) collapseSpace.current.style.height = "0px";
    setAnalysis(null);
    analysisRequest.current++;
    setAlignmentJobs([]);
    setAlignmentLoaded(false);
    setApplyingAlignment(null);
    applyingAlignmentRef.current = false;
    setExpanded(new Set());
    setActiveVerse(null);
    setReadingResetRevisions({});
    setPreviewOpen(false);
    setPreviewReading(null);
    setPreviewVoice(null);
    setPreviewView("composition");
    setPlayingVoice(null);
    for (const player of Object.values(voicePlayers.current)) player?.pause();
    return () => {
      analysisRequest.current++;
    };
  }, [base]);
  const inspect = useCallback(
    async (values: Settings, background = false) => {
      const request = ++analysisRequest.current;
      setAnalyzing(!background);
      setAnalysisError("");
      try {
        // Always retain baseline estimates. Offsets are applied locally and saved for rendering.
        const data = await api<Inspection>(endpoint("analyze"), {
          method: "POST",
          body: JSON.stringify({ ...values, verseOffsets: [] }),
        });
        if (request === analysisRequest.current) setAnalysis(data);
      } catch (cause) {
        if (request === analysisRequest.current)
          setAnalysisError(userMessage(cause));
      } finally {
        if (request === analysisRequest.current) setAnalyzing(false);
      }
    },
    [endpoint],
  );
  useEffect(() => {
    let live = true;
    let initialized = false;
    const refresh = async () => {
      try {
        const data = await api<{
          video: EditorProject;
          defaults: Settings;
          baseVoiceDefaults: BaseVoiceDefaults["es"];
          voiceStyleDefaults: VoiceStylePresets;
          mediaAccess: NonNullable<typeof mediaAccess>;
        }>(base);
        if (!live) return;
        setMediaAccess((current) =>
          current &&
          new URLSearchParams(current.query).get("loudnessTarget") ===
            new URLSearchParams(data.mediaAccess.query).get("loudnessTarget") &&
          current.expiresAt > Date.now() + 15 * 60 * 1000
            ? current
            : data.mediaAccess,
        );
        setLoudnessTarget(data.defaults.loudnessTarget);
        setBaseVoiceDefaults(data.baseVoiceDefaults);
        setVoiceStyleDefaults(data.voiceStyleDefaults);
        if (!initialized) {
          const values = settingsSchema.parse(
            data.video.settings && data.video.settings !== "{}"
              ? JSON.parse(data.video.settings)
              : data.defaults,
          );
          setSettings(values);
          initialized = true;
          void inspect(values);
        }
        setProject(data.video);
      } catch (cause) {
        if (live) setError(userMessage(cause));
        throw cause;
      }
    };
    const onFocus = () => {
      void refresh().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    const stopPolling = pollWhileVisible(
      refresh,
      () =>
        ["queued", "running"].includes(projectState.current?.status ?? "") ||
        !mediaAccessRef.current ||
        mediaAccessRef.current.expiresAt <= Date.now() + 15 * 60 * 1000,
      15000,
    );
    return () => {
      live = false;
      stopPolling();
      window.removeEventListener("focus", onFocus);
    };
  }, [base, inspect]);
  useEffect(() => {
    if (!project?.project_id) return;
    setVoicesLoaded(false);
    let live = true;
    const refresh = async () => {
      try {
        const data = await api<{ voices: Voices }>(endpoint("voices"));
        if (live) {
          setVoices(data.voices);
          setVoicesLoaded(true);
          setVoiceError("");
        }
      } catch (cause) {
        if (live) setVoiceError(userMessage(cause));
        throw cause;
      }
    };
    const stopPolling = pollWhileVisible(
      refresh,
      () =>
        Object.values(voiceState.current).some((voice) =>
          ["queued", "running"].includes(voice.status),
        ),
      10000,
    );
    return () => {
      live = false;
      stopPolling();
    };
  }, [project?.project_id, endpoint]);
  useEffect(() => {
    if (String(project?.project_id) !== projectId || !analysis) return;
    let live = true;
    const refresh = async () => {
      try {
        const data = await api<{
          jobs?: AlignmentJob[];
          job: AlignmentJob | null;
        }>(endpoint("alignment"));
        if (!live) return;
        const jobs = data.jobs ?? (data.job ? [data.job] : []);
        setAlignmentJobs((current) => [
          ...jobs,
          ...current.filter((item) => !jobs.some((job) => job.id === item.id)),
        ]);
        setAlignmentLoaded(true);
        if (
          busyRef.current ||
          taskSubmissions.pending.size ||
          applyingAlignmentRef.current
        )
          return;
        let changed = false;
        applyingAlignmentRef.current = true;
        try {
          for (const job of jobs) {
            if (!live || busyRef.current || taskSubmissions.pending.size) break;
            if (
              job.status !== "done" ||
              !job.result ||
              alignmentWasApplied(settingsRef.current, job.id) ||
              !alignmentSignatureMatches(job.result.signature, {
                kind,
                version: {
                  id: projectState.current!.version_code,
                  locale: projectState.current!.locale,
                },
                passage: JSON.parse(projectState.current!.passage),
                settings: settingsRef.current,
              })
            )
              continue;
            await taskSubmissions.enqueue(["alignment-apply"], async () => {
              if (!live) return;
              setApplyingAlignment(job);
              const alreadyApplied = alignmentWasApplied(
                settingsSchema.parse(
                  JSON.parse(projectState.current!.settings ?? "{}"),
                ),
                job.id,
              );
              const applied = await api<{ settings: Settings }>(
                endpoint("alignment/apply"),
                {
                  method: "POST",
                  body: JSON.stringify({
                    jobId: job.id,
                    settings: settingsRef.current,
                    expectedSettings: projectState.current?.settings,
                  }),
                },
              );
              if (!live) return;
              // Preserve edits in other blocks made while this result was saving.
              settingsRef.current = settingsSchema.parse({
                ...(alreadyApplied
                  ? settingsRef.current
                  : mergeAlignment(settingsRef.current, job.result!, job.id)),
                alignmentJobId: applied.settings.alignmentJobId,
                alignmentAppliedJobIds: applied.settings.alignmentAppliedJobIds,
              });
              if (projectState.current)
                projectState.current = {
                  ...projectState.current,
                  settings: JSON.stringify(applied.settings),
                };
              setSettings(settingsRef.current);
              setProject(projectState.current);
              changed = true;
            });
          }
        } finally {
          if (live) {
            applyingAlignmentRef.current = false;
            setApplyingAlignment(null);
          }
          if (live && changed) {
            await inspect(settingsRef.current, true);
            window.dispatchEvent(new Event(queueChangedEvent));
          }
        }
      } catch (cause) {
        if (live) {
          setAlignmentLoaded(true);
          setError(userMessage(cause));
        }
        throw cause;
      }
    };
    // Also discover jobs started in another editor and results finished while away.
    const stop = pollWhileVisible(refresh, () => true, 5000);
    return () => {
      live = false;
      stop();
    };
  }, [project?.project_id, projectId, Boolean(analysis), endpoint, inspect]);
  const active = Boolean(
    project && ["queued", "running"].includes(project.status),
  );
  const readingParts = (analysis?.sections ?? []).flatMap((section, index) =>
    settings.readingVoices?.[index]?.enabled ||
    section.originalAvailable === false
      ? [`reading-${index}` as const]
      : [],
  );
  const voicesReady =
    readingParts.every(
      (part) =>
        voices[part]?.available &&
        analysis?.generatedReadings?.[Number(part.slice(8))]?.available,
    ) &&
    voices.intro.available &&
    voices.outro.available &&
    (analysis?.chapterIntroductions ?? []).every(
      (chapter) => voices[chapter.part]?.available,
    ) &&
    !Object.values(voices).some((voice) =>
      ["queued", "running"].includes(voice.status),
    );
  const narrationParts: VoicePart[] = [
    "intro",
    ...(analysis?.chapterIntroductions ?? []).map((chapter) => chapter.part),
    "outro",
    ...readingParts,
  ];
  const missingNarrations = narrationParts.filter(
    (part) =>
      (!voices[part]?.available ||
        (part.startsWith("reading-") &&
          !analysis?.generatedReadings?.[Number(part.slice(8))]?.available)) &&
      !["queued", "running"].includes(voices[part]?.status ?? ""),
  );
  const narrationRequirement =
    kind !== "short" || readingParts.length > 0
      ? "Generate all section narrations before generating the video."
      : "Generate the introduction and closing voices before generating the video.";
  const editorActivity = {
    busy,
    submittingTasks: pendingTasks.size > 0,
    active,
    alignmentPending,
    alignmentAwaitingApply,
    applyingAlignment: Boolean(applyingAlignment),
    hasAnalysis: Boolean(analysis),
    alignmentLoaded,
  };
  const { editingLocked, taskQueueLocked } =
    editorActivityLocks(editorActivity);
  const readingLocks = (index: number) =>
    editorBlockLocks(editorActivity, {
      submitting:
        pendingTasks.has("alignment") || pendingTasks.has(`alignment-${index}`),
      alignmentBusy: alignmentScopeBusy(index),
      applyingAlignment: Boolean(
        applyingAlignment &&
        (applyingAlignment.sectionIndex === undefined ||
          applyingAlignment.sectionIndex === index),
      ),
    });
  const voiceLocks = (part: VoicePart) =>
    editorBlockLocks(editorActivity, {
      submitting: pendingTasks.has(`voice:${part}`),
      alignmentBusy: false,
      applyingAlignment: false,
    });
  const locked = editingLocked;
  const timeline = readingTimeline(analysis?.sections ?? []);
  const cues = adjustedCues(analysis?.cues ?? [], settings.verseOffsets);
  const verseTargets = useMemo(() => {
    const sections = readingTimeline(analysis?.sections ?? []);
    return (analysis?.cues ?? []).flatMap((cue) => {
      const section = sections.find(
        (section) =>
          cue.start >= section.timelineStart - 0.0001 &&
          cue.start < section.timelineEnd - 0.0001,
      );
      return section
        ? [{ reference: cue.reference, section: section.index }]
        : [];
    });
  }, [analysis]);
  const verseTargetsKey = JSON.stringify(verseTargets);
  const selectVerse = (target: VideoVerseTarget) => {
    setActiveVerse({ ...target, project: base });
    const fragment = videoVerseFragment(target, verseTargets);
    if (fragment && window.location.hash !== fragment)
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}${fragment}`,
      );
  };
  useEffect(() => {
    const targets: VideoVerseTarget[] = JSON.parse(verseTargetsKey);
    if (!targets.length || String(project?.project_id) !== projectId) return;
    let frame: number | undefined;
    const restore = () => {
      const target = parseVideoVerseFragment(window.location.hash, targets);
      if (!target) return;
      setActiveVerse({ ...target, project: base });
      setExpanded(
        (current) => new Set([...current, `reading-${target.section}`]),
      );
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        document
          .getElementById(`heading-reading-${target.section}`)
          ?.scrollIntoView({ block: "start" }),
      );
    };
    restore();
    window.addEventListener("hashchange", restore);
    return () => {
      window.removeEventListener("hashchange", restore);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [base, verseTargetsKey, project?.project_id, projectId]);
  const waveformKeys = [
    ...timeline
      .filter((section) => section.originalAvailable !== false)
      .map((section) => `${base}:${loudnessTarget}:reading-${section.index}`),
    ...narrationParts
      .filter(
        (part) =>
          !part.startsWith("reading-") &&
          voices[part]?.available &&
          !["queued", "running"].includes(voices[part]?.status ?? ""),
      )
      .map((part) => `${base}:${loudnessTarget}:${part}:${voiceRevision}`),
  ];
  const preparedCount = waveformKeys.filter(
    (key) => key in preparedWaveforms,
  ).length;
  const preparationFailed = waveformKeys.some(
    (key) => preparedWaveforms[key] === false,
  );
  const initialDataLoaded = Boolean(
    project &&
    (analysis || analysisError) &&
    !analyzing &&
    (voicesLoaded || voiceError),
  );
  const preparationComplete =
    initialDataLoaded && preparedCount === waveformKeys.length;
  useEffect(() => {
    if (preparationComplete) setPreparedEditor(base);
  }, [base, preparationComplete]);
  const preparing = preparedEditor !== base && !error;
  const preparationOverlay = preparing ? (
    <div
      className="editor-preparation-overlay"
      role="status"
      aria-live="polite"
    >
      <div className="editor-preparation-message">
        <LoaderCircle size={32} className="voice-spinner" aria-hidden="true" />
        <h2>{t("Preparing the editor…")}</h2>
        <p className="muted">
          {t("Loading audio so every section is ready to edit.")}
        </p>
        {waveformKeys.length > 0 && (
          <>
            <progress
              max={waveformKeys.length}
              value={preparedCount}
              aria-label={t("Preparing audio")}
            />
            <p className="muted">
              {t("{completed} of {total} audio tracks prepared")
                .replace("{completed}", String(preparedCount))
                .replace("{total}", String(waveformKeys.length))}
            </p>
          </>
        )}
      </div>
    </div>
  ) : null;

  const result = project?.result ? JSON.parse(project.result) : null;
  const perform = async (action: () => Promise<void>) => {
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      const data = await api<{ video: EditorProject }>(base);
      projectState.current = data.video;
      setProject(data.video);
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const submitTask = async (scopes: string[], action: () => Promise<void>) => {
    const requestedScope = base;
    try {
      await taskSubmissions.enqueue(scopes, async () => {
        if (readingChangeScope.current !== requestedScope) return;
        setError("");
        await action();
        const data = await api<{ video: EditorProject }>(base);
        if (readingChangeScope.current !== requestedScope) return;
        projectState.current = data.video;
        setProject(data.video);
      });
    } catch (cause) {
      if (readingChangeScope.current === requestedScope)
        setError(userMessage(cause));
    }
  };
  const checkedSettings = () => {
    if (
      analysis &&
      !validVerseTimings(
        adjustedCues(analysis.cues, settingsRef.current.verseOffsets),
        analysis.sections.reduce(
          (total, section) => total + section.end - section.start,
          0,
        ),
      )
    ) {
      throw new Error(
        "Some verse timings fall outside the passage or have a start after the end. Review the start and end adjustments.",
      );
    }
    return settingsSchema.parse(settingsRef.current);
  };
  const save = async () => {
    await api(endpoint(), {
      method: "PATCH",
      body: JSON.stringify({
        settings: checkedSettings(),
      }),
    });
    const current = await api<{ mediaAccess: NonNullable<typeof mediaAccess> }>(
      base,
    );
    setMediaAccess(current.mediaAccess);
    setSaved(true);
    notify("Changes saved.");
  };
  const queueAlignment = async (sectionIndex?: number) => {
    if (
      !analysis ||
      analyzing ||
      taskQueueLocked ||
      busyRef.current ||
      alignmentScopeBusy(sectionIndex)
    )
      return;
    await submitTask(
      sectionIndex === undefined
        ? [
            "alignment",
            ...analysis.sections.map((_, index) => `alignment-${index}`),
          ]
        : [`alignment-${sectionIndex}`],
      async () => {
        await save();
        if (readingChangeScope.current !== base) return;
        const { job } = await api<{ job: AlignmentJob }>(
          endpoint("alignment"),
          {
            method: "POST",
            body: JSON.stringify({ ...checkedSettings(), sectionIndex }),
          },
        );
        if (readingChangeScope.current !== base) return;
        setAlignmentJobs((current) => [
          ...current.filter((item) => item.id !== job.id),
          job,
        ]);
        window.dispatchEvent(new Event(queueChangedEvent));
      },
    );
  };
  const trim = (
    reference: string,
    edge: "start" | "end",
    value: number,
    manuallyAdjusted = true,
  ) => {
    const original = analysis?.cues.find((cue) => cue.reference === reference);
    if (!original) return;
    setSettings((current) => {
      const old = current.verseOffsets.find(
        (offset) => offset.reference === reference,
      ) ?? { reference, startOffsetSeconds: 0, endOffsetSeconds: 0 };
      const next = {
        ...old,
        manuallyAdjusted,
        [edge === "start" ? "startOffsetSeconds" : "endOffsetSeconds"]:
          value - original[edge],
      };
      return {
        ...current,
        alignmentReviewReferences: manuallyAdjusted
          ? current.alignmentReviewReferences?.filter(
              (item) => item !== reference,
            )
          : current.alignmentReviewReferences,
        verseOffsets: [
          ...current.verseOffsets.filter(
            (offset) => offset.reference !== reference,
          ),
          next,
        ],
      };
    });
  };
  const expandSection = (
    sectionIndex: number,
    edge: "start" | "end",
    seconds = 10,
  ) => {
    if (!analysis) return;
    const section = analysis.sections[sectionIndex];
    const amount = Math.min(
      seconds,
      edge === "start"
        ? section.start
        : (section.sourceDuration ?? section.end) - section.end,
    );
    if (amount <= 0) return;
    const change = {
      sectionIndex,
      beforeSeconds: edge === "start" ? amount : 0,
      afterSeconds: edge === "end" ? amount : 0,
    };
    const expanded = expandReadingContext(
      analysis.sections,
      analysis.cues,
      analysis.sections.map((entry) => entry.sourceDuration ?? entry.end),
      [change],
    );
    setAnalysis({ ...analysis, ...expanded });
    setSettings((current) => {
      const previous = current.readingSectionPadding.find(
        (entry) => entry.sectionIndex === sectionIndex,
      );
      return {
        ...current,
        readingSectionPadding: [
          ...current.readingSectionPadding.filter(
            (entry) => entry.sectionIndex !== sectionIndex,
          ),
          {
            sectionIndex,
            beforeSeconds:
              (previous?.beforeSeconds ?? 0) + change.beforeSeconds,
            afterSeconds: (previous?.afterSeconds ?? 0) + change.afterSeconds,
          },
        ],
      };
    });
  };
  const shiftVerse = (
    sectionIndex: number,
    cue: VerseCue,
    manuallyAdjusted: boolean,
  ) => {
    if (!analysis || readingLocks(sectionIndex).editingLocked || analyzing)
      return false;
    const section = timeline[sectionIndex];
    const availableEnd =
      section.timelineStart +
      (section.sourceDuration ?? section.end) -
      section.start;
    if (cue.end > availableEnd + 1e-6) return false;
    // Expose enough original audio without moving this chapter's existing source cuts.
    if (cue.end > section.timelineEnd)
      expandSection(sectionIndex, "end", cue.end - section.timelineEnd);
    trim(cue.reference, "start", cue.start, manuallyAdjusted);
    trim(cue.reference, "end", cue.end, manuallyAdjusted);
    return true;
  };
  const queueVoice = async (
    part: VoicePart,
    verseReference?: string,
    textOverride?: string,
  ) => {
    const requestedScope = base;
    const generationSettings = part.startsWith("reading-")
      ? settingsSchema.parse(settingsRef.current)
      : checkedSettings();
    const trims = { ...generationSettings.voiceTrims };
    delete trims[part];
    const generation = await api<{
      mediaAccess?: NonNullable<typeof mediaAccess>;
    }>(endpoint("voices"), {
      method: "POST",
      body: JSON.stringify({
        part,
        verseReference,
        textOverride,
        settings: { ...generationSettings, voiceTrims: trims },
      }),
    });
    if (readingChangeScope.current !== requestedScope) return;
    const current = settingsRef.current;
    const currentTrims = { ...current.voiceTrims };
    delete currentTrims[part];
    const next: Settings = {
      ...current,
      voiceTrims: currentTrims,
      ...(part.startsWith("reading-")
        ? {
            readingVoices: {
              ...current.readingVoices,
              [part.slice(8)]: {
                enabled: true,
                verseOffsets: verseReference
                  ? (
                      current.readingVoices?.[part.slice(8)]?.verseOffsets ?? []
                    ).filter((cut) => cut.reference !== verseReference)
                  : [],
              },
            },
          }
        : {}),
    };
    // The next accepted submission must see these changes before React renders.
    settingsRef.current = next;
    setSettings(next);
    if (generation.mediaAccess) {
      const access = generation.mediaAccess;
      setMediaAccess((current) =>
        current &&
        current.expiresAt > Date.now() + 15 * 60 * 1000 &&
        new URLSearchParams(current.query).get("voiceParameters") ===
          new URLSearchParams(access.query).get("voiceParameters") &&
        new URLSearchParams(current.query).get("voiceModel") ===
          new URLSearchParams(access.query).get("voiceModel") &&
        new URLSearchParams(current.query).get("baseVoice") ===
          new URLSearchParams(access.query).get("baseVoice")
          ? current
          : access,
      );
    }
    setVoices((current) => ({
      ...current,
      [part]: { ...current[part], status: "queued", progress: 0 },
    }));
    setVoiceRevision((value) => value + 1);
    window.dispatchEvent(new Event(queueChangedEvent));
  };
  const stopVoicePlayback = () => {
    for (const player of Object.values(voicePlayers.current)) player?.pause();
    setPlayingVoice(null);
  };
  const generateVoice = (
    part: VoicePart,
    verseReference?: string,
    textOverride?: string,
  ) => {
    if (
      taskQueueLocked ||
      busyRef.current ||
      ["queued", "running"].includes(voiceState.current[part]?.status ?? "")
    )
      return;
    return submitTask([`voice:${part}`], async () => {
      stopVoicePlayback();
      await queueVoice(part, verseReference, textOverride);
    });
  };
  const generateMissingVoices = () => {
    if (taskQueueLocked || busyRef.current) return;
    return submitTask(
      ["voices", ...missingNarrations.map((part) => `voice:${part}`)],
      async () => {
        stopVoicePlayback();
        // Recheck shared chapter recordings and pending work before adding anything.
        const current = await api<{ voices: Voices }>(endpoint("voices"));
        setVoices(current.voices);
        for (const part of missingNarrations) {
          if (readingChangeScope.current !== base) return;
          const voice = current.voices[part];
          if (
            !voice?.available &&
            !["queued", "running"].includes(voice?.status ?? "")
          )
            await queueVoice(part);
        }
      },
    );
  };
  const toggleVoicePlayback = async (part: VoicePart) => {
    const player = voicePlayers.current[part];
    if (!player) return;
    if (!player.paused) {
      player?.pause();
      return;
    }
    setVoiceError("");
    try {
      await player.play();
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        setVoiceError("Could not play the narration. Try again.");
    }
  };
  const readingChangeScope = useRef(base);
  readingChangeScope.current = base;
  const autoReading = useRef(new Set<string>());
  const finishedReadings = useRef(new Set<string>());
  const changeReadingVoice = async (index: number, enabled: boolean) => {
    if (
      readingChangeScope.current !== base ||
      taskSubmissions.pending.has(`voice:reading-${index}`)
    )
      return;
    const next = settingsSchema.parse({
      ...settingsRef.current,
      readingVoices: {
        ...settingsRef.current.readingVoices,
        [index]: {
          enabled,
          verseOffsets:
            settingsRef.current.readingVoices?.[index]?.verseOffsets ?? [],
        },
      },
    });
    settingsRef.current = next;
    setSettings(next);
    await submitTask([`voice:reading-${index}`], async () => {
      await api(endpoint(), {
        method: "PATCH",
        body: JSON.stringify({ settings: settingsRef.current }),
      });
      const voice = voiceState.current[`reading-${index}`];
      if (
        enabled &&
        readingChangeScope.current === base &&
        !analysis?.generatedReadings?.[index]?.available &&
        !voice?.available &&
        !["queued", "running"].includes(voice?.status ?? "")
      )
        await queueVoice(`reading-${index}`);
    });
  };
  useEffect(() => {
    autoReading.current.clear();
    finishedReadings.current.clear();
  }, [base]);
  useEffect(() => {
    if (!analysis || !voicesLoaded || String(project?.project_id) !== projectId)
      return;
    const missing = analysis.sections
      .map((section, index) => ({ section, index }))
      .filter(
        ({ section, index }) =>
          section.originalAvailable === false &&
          settingsRef.current.readingVoices?.[index]?.enabled !== true &&
          !autoReading.current.has(`${base}:${index}`),
      );
    for (const { index } of missing)
      autoReading.current.add(`${base}:${index}`);
    if (missing.length)
      void (async () => {
        for (const { index } of missing) {
          if (readingChangeScope.current !== base) return;
          await changeReadingVoice(index, true);
        }
      })();
    for (const [part, voice] of Object.entries(voices)) {
      const key = `${base}:${part}:${voice.jobId}`;
      if (
        part.startsWith("reading-") &&
        voice.status === "done" &&
        voice.jobId &&
        !finishedReadings.current.has(key)
      ) {
        finishedReadings.current.add(key);
        void inspect(settingsRef.current, true);
      }
    }
  }, [analysis, voicesLoaded, voices, base, inspect]);
  const generatedReading = (
    index: number,
    reference: string,
    selectReference: (reference: string) => void,
    pronunciation: { textOverride?: string; editing: boolean },
  ) => {
    const voiceLocked = voiceLocks(`reading-${index}`).editingLocked;
    const original = analysis?.sections[index];
    const track = analysis?.generatedReadings?.[index];
    const enabled =
      settings.readingVoices?.[index]?.enabled ||
      original?.originalAvailable === false;
    const state = voices[`reading-${index}`];
    const pending = Boolean(
      pendingTasks.has(`voice:reading-${index}`) ||
      (state && ["queued", "running"].includes(state.status)),
    );
    const offsets = settings.readingVoices?.[index]?.verseOffsets ?? [];
    const generatedCues = adjustedCues(track?.cues ?? [], offsets);
    const trimGenerated = (
      reference: string,
      edge: "start" | "end",
      value: number,
    ) => {
      const baseline = track?.cues.find((cue) => cue.reference === reference);
      if (!baseline) return;
      setSettings((current) => {
        const previous = current.readingVoices?.[index];
        const entry = {
          reference,
          startOffsetSeconds: 0,
          endOffsetSeconds: 0,
          ...previous?.verseOffsets.find((cut) => cut.reference === reference),
          [edge === "start" ? "startOffsetSeconds" : "endOffsetSeconds"]:
            value - baseline[edge],
          manuallyAdjusted: true,
        };
        return {
          ...current,
          readingVoices: {
            ...current.readingVoices,
            [index]: {
              enabled: true,
              verseOffsets: [
                ...(previous?.verseOffsets ?? []).filter(
                  (cut) => cut.reference !== reference,
                ),
                entry,
              ],
            },
          },
        };
      });
    };
    const showWaveform = Boolean(enabled && track?.available && !pending);
    const voiceToggle = (
      <label className="checkbox">
        <input
          type="checkbox"
          checked={Boolean(enabled)}
          disabled={
            voiceLocked || pending || original?.originalAvailable === false
          }
          onChange={(event) =>
            void changeReadingVoice(index, event.target.checked)
          }
        />
        {t("Use generated voice for this reading")}
      </label>
    );
    return (
      <div className="generated-reading-section">
        {!showWaveform && voiceToggle}
        {original?.originalAvailable === false && (
          <p className="notice">
            {t(
              "No original recording is available. Generate this reading to use it in the video.",
            )}
          </p>
        )}
        {enabled && pending && (
          <GenerationProgress
            value={state?.progress ?? 0}
            label={t("Generating passage reading…")}
          />
        )}
        {enabled && state?.status === "failed" && (
          <p className="error">{t(voiceFailureMessage(state.failureReason))}</p>
        )}
        {showWaveform && track ? (
          <VerseWaveform
            compact
            toolbarLeading={voiceToggle}
            toolbarActions={
              <button
                type="button"
                className="icon-button"
                disabled={voiceLocked || analyzing || pronunciation.editing}
                aria-label={t("Regenerate all reading verses")}
                data-tooltip={t("Regenerate all reading verses")}
                onClick={() => void generateVoice(`reading-${index}`)}
              >
                <WandSparkles size={16} aria-hidden="true" />
              </button>
            }
            regenerateLabel="Regenerate this verse"
            regenerateIcon={<WandSparkles size={16} aria-hidden="true" />}
            regenerationDisabled={
              taskQueueLocked || pending || analyzing || pronunciation.editing
            }
            selectedReference={reference}
            onSelectReference={selectReference}
            key={`${index}:${track.revision}`}
            onPrepared={onWaveformPrepared}
            resourceKey={`${base}:${loudnessTarget}:generated-${index}:${track.revision}`}
            expanded={expanded.has(`reading-${index}`)}
            locale={project?.locale ?? "en"}
            src={`${media(`generated-reading-${index}`)}&revision=${track.revision}`}
            sourceStart={0}
            sourceEnd={track.duration}
            sourceDuration={track.duration}
            timelineStart={0}
            onExpand={() => {}}
            volumeMultiplier={1}
            cues={generatedCues}
            disabled={voiceLocked || analyzing}
            onRegenerate={() =>
              void generateVoice(
                `reading-${index}`,
                reference,
                pronunciation.textOverride,
              )
            }
            onTrim={trimGenerated}
            onShift={(cue) => {
              trimGenerated(cue.reference, "start", cue.start);
              trimGenerated(cue.reference, "end", cue.end);
              return true;
            }}
            // Alignment is stored in the generated track's baseline, even before manual edits.
            preservedReferences={generatedCues.map((cue) => cue.reference)}
          />
        ) : (
          enabled &&
          !pending && (
            <button
              type="button"
              disabled={taskQueueLocked || analyzing || pronunciation.editing}
              onClick={() =>
                void generateVoice(
                  `reading-${index}`,
                  pronunciation.textOverride === undefined
                    ? undefined
                    : reference,
                  pronunciation.textOverride,
                )
              }
            >
              <WandSparkles size={16} aria-hidden="true" />
              {t("Generate voice")}
            </button>
          )
        )}
      </div>
    );
  };
  const toggle = (id: string) => {
    const heading = document.getElementById(`heading-${id}`);
    if (expanded.has(id) && heading)
      collapseAnchor.current = { id, top: heading.getBoundingClientRect().top };
    if (!expanded.has(id) && id.startsWith("reading-")) {
      const section = Number(id.slice(8));
      const target = verseTargets.find(
        (target) =>
          target.section === section &&
          (activeVerse?.project !== base ||
            activeVerse.section !== section ||
            target.reference === activeVerse.reference),
      );
      if (target) selectVerse(target);
    }
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleFromHeading = (id: string, event: MouseEvent<HTMLElement>) => {
    if (!(event.target as Element).closest("button")) toggle(id);
  };
  const sectionIds = [
    "intro",
    ...(timeline.length
      ? timeline.flatMap((section) =>
          kind !== "short"
            ? [`chapter-${section.index}`, `reading-${section.index}`]
            : [`reading-${section.index}`],
        )
      : ["reading-0"]),
    "outro",
  ];
  const sectionHeading = (
    id: string,
    number: number,
    title: string,
    summary: string,
    voice = false,
    readingReferences: string[] = [],
  ) => {
    const readingLocked = readingLocks(Number(id.slice(8))).editingLocked;
    const content = (
      <>
        <span className="section-number">
          {String(number).padStart(2, "0")}
        </span>
        <span className={`section-role ${voice ? "voice" : "reading"}`}>
          {voice ? <Mic size={15} /> : <AudioLines size={15} />}
          {voice ? t("Voice") : t("Reading")}
        </span>
        <span className="section-heading-text">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
      </>
    );
    const chevron = (
      <ChevronDown size={18} className={expanded.has(id) ? "expanded" : ""} />
    );
    if (voice)
      return (
        <button
          type="button"
          className="section-heading"
          aria-expanded={expanded.has(id)}
          aria-controls={`section-${id}`}
          onClick={() => toggle(id)}
        >
          {content}
        </button>
      );
    return (
      <div
        id={`heading-${id}`}
        className="reading-section-heading"
        onClick={(event) => toggleFromHeading(id, event)}
      >
        <button
          type="button"
          className="section-heading"
          aria-expanded={expanded.has(id)}
          aria-controls={`section-${id}`}
          onClick={() => toggle(id)}
        >
          {content}
        </button>
        <button
          type="button"
          className="icon-button section-action-button"
          aria-label={t("Generate voice")}
          data-tooltip={t("Generate voice")}
          disabled={
            taskQueueLocked ||
            pendingTasks.has(`voice:${id}`) ||
            ["queued", "running"].includes(
              voices[id as VoicePart]?.status ?? "",
            ) ||
            analyzing ||
            !(
              settings.readingVoices?.[Number(id.slice(8))]?.enabled ||
              analysis?.sections[Number(id.slice(8))]?.originalAvailable ===
                false
            )
          }
          onClick={() => void generateVoice(id as VoicePart)}
        >
          <WandSparkles size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="analysis-retry"
          aria-label={
            analyzing
              ? t("Loading audio and verses…")
              : t("Analyze audio again")
          }
          data-tooltip={
            analyzing
              ? t("Loading audio and verses…")
              : t(
                  "Reanalyze the entire passage if the source audio or passage boundaries changed, or if analysis failed. Otherwise, results usually stay the same and do not improve manual cuts. Your adjustments are kept, but cuts may move if the estimated timings change. No audio is generated and no changes are saved.",
                )
          }
          disabled={analyzing || taskQueueLocked}
          onClick={() => void inspect(settings)}
        >
          {analyzing ? (
            <LoaderCircle size={16} className="voice-spinner" />
          ) : (
            <AudioWaveform size={17} />
          )}
        </button>
        <button
          type="button"
          className="icon-button section-action-button"
          aria-label={t("Analyze this reading with AI")}
          data-tooltip={t(
            "Analyze this reading with AI. Manual verse adjustments are preserved.",
          )}
          disabled={
            taskQueueLocked ||
            analyzing ||
            !readingReferences.length ||
            alignmentScopeBusy(Number(id.replace("reading-", ""))) ||
            analysis?.sections[Number(id.slice(8))]?.originalAvailable === false
          }
          onClick={() =>
            void queueAlignment(Number(id.replace("reading-", "")))
          }
        >
          <ScanText size={17} />
        </button>
        <button
          type="button"
          className="icon-button section-action-button"
          aria-label={t("Reset manual verse cuts")}
          data-tooltip={t(
            "Restore estimated cuts for manually adjusted verses in this reading so AI can update them again. Other verse cuts are kept.",
          )}
          disabled={
            readingLocked ||
            analyzing ||
            !readingReferences.some((reference) =>
              verseHasManualCuts(settings.verseOffsets, reference),
            )
          }
          onClick={() => {
            setSettings((current) => ({
              ...current,
              verseOffsets: resetManualVerseCuts(
                current.verseOffsets,
                readingReferences,
              ),
            }));
            setReadingResetRevisions((current) => ({
              ...current,
              [id]: (current[id] ?? 0) + 1,
            }));
          }}
        >
          <UnfoldHorizontal size={17} aria-hidden="true" />
        </button>
        <span className="section-action-separator" aria-hidden="true" />
        <button
          type="button"
          className="icon-button section-preview-button"
          aria-label={t("Preview this passage")}
          data-tooltip={t("Preview this passage")}
          aria-haspopup="dialog"
          disabled={
            analyzing ||
            !readingReferences.length ||
            ((settings.readingVoices?.[Number(id.slice(8))]?.enabled ||
              analysis?.sections[Number(id.slice(8))]?.originalAvailable ===
                false) &&
              !voices[id as VoicePart]?.available)
          }
          onClick={() => {
            setPreviewReading({
              references: readingReferences,
              title,
              sectionId: id,
            });
            Object.values(voicePlayers.current).forEach((player) =>
              player?.pause(),
            );
            setPreviewVoice(null);
            setPreviewView("composition");
            setPreviewOpen(true);
          }}
        >
          <Clapperboard size={16} />
        </button>
        <button
          type="button"
          className="reading-section-expand icon-button"
          aria-label={title}
          aria-expanded={expanded.has(id)}
          aria-controls={`section-${id}`}
          onClick={() => toggle(id)}
        >
          {chevron}
        </button>
      </div>
    );
  };
  const sectionVisuals = (id: string, references?: string[]) => (
    <SectionVisualElements
      key={`visuals-${base}-${id}`}
      kind={kind}
      locale={project?.locale ?? "en"}
      previewDisabled={
        !analysis ||
        analyzing ||
        (id.startsWith("reading-")
          ? !references?.length ||
            ((settings.readingVoices?.[Number(id.slice(8))]?.enabled ||
              analysis.sections[Number(id.slice(8))]?.originalAvailable ===
                false) &&
              !voices[id as VoicePart]?.available)
          : !voices[id as VoicePart]?.available)
      }
      onPreview={() => {
        Object.values(voicePlayers.current).forEach((player) =>
          player?.pause(),
        );
        setPreviewReading(
          id.startsWith("reading-")
            ? {
                references: references ?? [],
                title: t("Passage reading"),
                sectionId: id,
              }
            : null,
        );
        setPreviewVoice(id.startsWith("reading-") ? null : (id as VoicePart));
        setPreviewView("composition");
        setPreviewOpen(true);
      }}
      elements={settings.visualElements?.[id] ?? []}
      references={references}
      disabled={
        taskQueueLocked || (id.startsWith("reading-") && !references?.length)
      }
      onChange={(elements: VisualElement[]) =>
        setSettings((current) => {
          const visualElements = { ...current.visualElements };
          if (elements.length)
            visualElements[id] = elements.map((element) => ({
              ...element,
              id: element.id ?? crypto.randomUUID(),
            }));
          else delete visualElements[id];
          return { ...current, visualElements };
        })
      }
    />
  );
  const voiceSection = (part: VoicePart, number: number) => {
    const voice = voices[part] ?? { available: false, status: "idle" };
    const pending =
      pendingTasks.has(`voice:${part}`) ||
      ["queued", "running"].includes(voice.status);
    const chapter = analysis?.chapterIntroductions?.find(
      (item) => item.part === part,
    );
    const defaultScript =
      chapter?.script ??
      (part === "intro" || part === "outro" ? analysis?.scripts[part] : "") ??
      "";
    const narrationText =
      settings.voiceScriptOverrides?.[part] ?? defaultScript;
    const title = chapter
      ? `${t("Chapter introduction")} · ${chapter.title}`
      : part === "intro"
        ? t("Introduction")
        : t("Closing");
    const generateLabel = pending
      ? t("Preparing narration…")
      : voice.available
        ? t("Regenerate narration")
        : t("Generate narration");
    const playLabel =
      playingVoice === part ? t("Pause narration") : t("Listen to narration");
    const generateAction = (
      <button
        type="button"
        className="primary"
        disabled={
          taskQueueLocked || pending || !analysis || !narrationText.trim()
        }
        onClick={() => void generateVoice(part)}
      >
        <WandSparkles size={16} />
        {generateLabel}
      </button>
    );
    return (
      <section className="section-card" key={part}>
        <div
          id={`heading-${part}`}
          className="voice-section-heading"
          onClick={(event) => toggleFromHeading(part, event)}
        >
          {sectionHeading(
            part,
            number,
            title,
            pending
              ? t("Preparing narration…")
              : voice.available
                ? t("Narration ready to listen")
                : t("Generate narration for this section"),
            true,
          )}
          <div className="voice-section-actions">
            <button
              type="button"
              aria-label={`${generateLabel} · ${title}`}
              data-tooltip={generateLabel}
              disabled={
                taskQueueLocked || pending || !analysis || !narrationText.trim()
              }
              onClick={() => void generateVoice(part)}
            >
              {pending ? (
                <LoaderCircle size={17} className="voice-spinner" />
              ) : (
                <WandSparkles size={17} />
              )}
            </button>
            <span className="section-action-separator" aria-hidden="true" />
            <button
              type="button"
              aria-label={`${playLabel} · ${title}`}
              data-tooltip={playLabel}
              disabled={!voice.available || pending}
              onClick={() => void toggleVoicePlayback(part)}
            >
              {playingVoice === part ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <button
              type="button"
              className="icon-button section-preview-button"
              aria-label={`${t("Preview")} · ${title}`}
              data-tooltip={
                voice.available
                  ? t("Preview")
                  : t("Generate narration for this section")
              }
              aria-haspopup="dialog"
              disabled={!voice.available || pending || !analysis || analyzing}
              onClick={() => {
                Object.values(voicePlayers.current).forEach((player) =>
                  player?.pause(),
                );
                setPreviewReading(null);
                setPreviewVoice(part);
                setPreviewView("composition");
                setPreviewOpen(true);
              }}
            >
              <Clapperboard size={16} />
            </button>
            <button
              type="button"
              className="voice-section-expand icon-button"
              aria-label={title}
              aria-expanded={expanded.has(part)}
              aria-controls={`section-${part}`}
              onClick={() => toggle(part)}
            >
              <ChevronDown
                size={18}
                className={expanded.has(part) ? "expanded" : ""}
              />
            </button>
          </div>
        </div>
        {pending && (
          <GenerationProgress
            value={voice.progress ?? 0}
            label={t("Voice generation")}
          />
        )}
        <div
          id={`section-${part}`}
          hidden={!expanded.has(part)}
          className="section-body voice-section-body"
        >
          <div className="narration-script">
            <p className="eyebrow">{t("Narration script")}</p>
            <textarea
              aria-label={`${t("Narration script")} · ${title}`}
              rows={5}
              maxLength={10000}
              disabled={taskQueueLocked || pending || !analysis}
              placeholder={t("The script will appear once the passage loads.")}
              value={narrationText}
              onChange={(event) => {
                const text = event.target.value;
                setSettings((current) => {
                  const overrides = { ...current.voiceScriptOverrides };
                  if (text === defaultScript) delete overrides[part];
                  else overrides[part] = text;
                  return { ...current, voiceScriptOverrides: overrides };
                });
              }}
            />
            <span className="muted">
              {t(
                "Edit the narration before generating or regenerating its audio. Save changes to keep this text for the project. Write numbers as words for clearer pronunciation.",
              )}
            </span>
          </div>
          <div className="narration-preview">
            <div className="section-preview-icon">
              <Mic size={26} />
            </div>
            <h3>{t("Narration preview")}</h3>
            {voice.available && !pending ? (
              <VoiceWaveform
                resourceKey={`${base}:${loudnessTarget}:${part}:${voiceRevision}`}
                onPrepared={onWaveformPrepared}
                generateAction={generateAction}
                audioRef={(player) => {
                  if (player) voicePlayers.current[part] = player;
                  else delete voicePlayers.current[part];
                }}
                key={`${part}-${voice.status}-${voiceRevision}`}
                src={`${media(part)}&revision=${voiceRevision}`}
                expanded={expanded.has(part)}
                disabled={taskQueueLocked || pending}
                trim={settings.voiceTrims?.[part] ?? voice.automaticTrim}
                onTrim={(trim) =>
                  setSettings((current) => {
                    const trims = { ...current.voiceTrims };
                    if (trim) trims[part] = trim;
                    else delete trims[part];
                    return { ...current, voiceTrims: trims };
                  })
                }
                onPlaybackChange={(playing) => {
                  if (playing) {
                    Object.entries(voicePlayers.current).forEach(
                      ([key, player]) => {
                        if (key !== part) player?.pause();
                      },
                    );
                    setPlayingVoice(part);
                  } else
                    setPlayingVoice((current) =>
                      current === part ? null : current,
                    );
                }}
                onError={() => {
                  setPlayingVoice((current) =>
                    current === part ? null : current,
                  );
                  setVoiceError("Could not play the narration. Try again.");
                }}
              />
            ) : (
              <p className="muted">
                {pending
                  ? t(
                      "The narration will be available here once preparation is complete.",
                    )
                  : t(
                      "Generate the audio to listen to this section before creating the video.",
                    )}
              </p>
            )}
            {voice.status === "failed" && (
              <p className="error">
                {t(voiceFailureMessage(voice.failureReason))}
              </p>
            )}
            {(!voice.available || pending) && generateAction}
          </div>
          {sectionVisuals(part)}
        </div>
      </section>
    );
  };
  if (!project)
    return (
      <>
        {preparationOverlay}
        <section className="panel" inert={preparing} aria-busy={preparing}>
          <Link className="button" href={backHref}>
            <ChevronLeft size={16} />
            {t("Back to projects")}
          </Link>
          <p
            className={error ? "error" : "empty"}
            role={error ? "alert" : "status"}
          >
            {t(error || "Loading project…")}
          </p>
        </section>
      </>
    );
  return (
    <>
      {preparationOverlay}
      <div
        style={{ display: "contents" }}
        inert={preparing}
        aria-busy={preparing}
      >
        {preparationFailed && !preparing && (
          <p className="notice" role="status">
            {t(
              "Some audio could not be prepared. Open its section to retry loading it.",
            )}
          </p>
        )}
        <ProjectEditorHeader
          title={project.title}
          version={project.version_code ?? ""}
          backHref={backHref}
        >
          <button
            className={saved ? "save-confirmed" : undefined}
            aria-label={saved ? t("Changes saved") : t("Save changes")}
            data-tooltip={saved ? t("Changes saved") : t("Save changes")}
            disabled={editingLocked}
            onClick={() => {
              setSaved(false);
              void perform(save);
            }}
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? t("Changes saved") : t("Save changes")}
          </button>
          <button
            type="button"
            aria-label={t("Preview")}
            data-tooltip={t("Preview")}
            onClick={() => {
              setPreviewView("composition");
              setPreviewReading(null);
              setPreviewVoice(null);
              Object.values(voicePlayers.current).forEach((player) =>
                player?.pause(),
              );
              setPreviewOpen(true);
            }}
            aria-haspopup="dialog"
          >
            <Clapperboard size={16} />
            {t("Preview")}
          </button>
          <button
            className="primary"
            disabled={locked || !analysis || analyzing || !voicesReady}
            aria-label={
              active
                ? t("Generating")
                : result
                  ? t("Generate video again")
                  : t("Generate video")
            }
            data-tooltip={
              !voicesReady
                ? t(narrationRequirement)
                : active
                  ? t("Generating")
                  : result
                    ? t("Generate video again")
                    : t("Generate video")
            }
            onClick={() =>
              void perform(async () => {
                await api(endpoint("render"), {
                  method: "POST",
                  body: JSON.stringify({
                    ...checkedSettings(),
                    readingCuts: adjustedCues(
                      analysis!.cues,
                      settingsRef.current.verseOffsets,
                    ).map(({ reference, start, end }) => ({
                      reference,
                      start,
                      end,
                    })),
                  }),
                });
                window.dispatchEvent(new Event(queueChangedEvent));
              })
            }
          >
            <Play size={16} />
            {active
              ? t("Generating")
              : result
                ? t("Generate video again")
                : t("Generate video")}
          </button>
        </ProjectEditorHeader>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {voiceError && (
          <p className="error" role="alert">
            {t(voiceError)}
          </p>
        )}
        {active && (
          <div className="project-render-progress">
            <GenerationProgress
              value={project.progress ?? 0}
              label={t("Video generation")}
            />
          </div>
        )}
        <details className="panel project-voice-settings project-configuration">
          <summary>
            <span className="project-configuration-title">
              <Settings size={18} aria-hidden="true" />
              {t("Project configuration")}
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="project-configuration-content">
            <section aria-labelledby="project-narration-settings-title">
              <h2 id="project-narration-settings-title">
                {t("Narration voice")}
              </h2>
              <p className="muted">
                {t(
                  "Choose voices and narration styles for this project. Existing recordings stay unchanged until you regenerate them.",
                )}
              </p>
              <div className="project-narration-columns">
                {(["intro", "reading", "outro"] as const).map((role) => (
                  <BaseVoiceSelector
                    key={role}
                    inheritFormatSettings
                    defaultPreset={voiceStyleDefaults[role]}
                    label={roleLabels[role]}
                    preset={settings.voiceStylePresets?.[role]}
                    onPresetChange={(preset) =>
                      setSettings((current) => ({
                        ...current,
                        voiceStylePresets: {
                          ...current.voiceStylePresets,
                          [role]: preset,
                        },
                      }))
                    }
                    locale={project.locale as VoiceLocale}
                    defaultVoice={baseVoiceDefaults[role]}
                    value={
                      settings.inheritedBaseVoiceRoles?.includes(role)
                        ? ""
                        : projectBaseVoice(
                            settings,
                            project.locale as VoiceLocale,
                            role,
                          )
                    }
                    onChange={(id) =>
                      setSettings((current) => ({
                        ...current,
                        inheritedBaseVoiceRoles: [
                          ...(current.inheritedBaseVoiceRoles ?? []).filter(
                            (value) => value !== role,
                          ),
                          ...(!id ? [role] : []),
                        ],
                        baseVoices: {
                          intro: projectBaseVoice(
                            current,
                            project.locale as VoiceLocale,
                            "intro",
                          ),
                          reading: projectBaseVoice(
                            current,
                            project.locale as VoiceLocale,
                            "reading",
                          ),
                          outro: projectBaseVoice(
                            current,
                            project.locale as VoiceLocale,
                            "outro",
                          ),
                          ...current.baseVoices,
                          ...(id ? { [role]: id } : {}),
                        },
                      }))
                    }
                    disabled={locked}
                  />
                ))}
              </div>
              <p className="muted">
                {t(
                  "“Default” uses the value configured in the Settings modal on the corresponding format page.",
                )}
              </p>
            </section>
            <section aria-labelledby="project-audio-source-title">
              <h2 id="project-audio-source-title">
                {t("Chapter audio source")}
              </h2>
              <AudioLibrarySelector
                label="Audio version"
                locale={project.locale}
                code={project.version_code}
                value={settings.audioEdition}
                disabled={locked || analyzing}
                onChange={(audioEdition) => {
                  const next = {
                    ...settings,
                    audioEdition,
                    readingVoices: {},
                    verseOffsets: [],
                    readingSectionPadding: [],
                    passageOffsets: { startSeconds: 0, endSeconds: 0 },
                    alignmentReviewReferences: [],
                  };
                  setSettings(next);
                  void inspect(next);
                }}
              />
            </section>
          </div>
        </details>
        <div className="project-studio-layout">
          <div className="section-stack">
            <div className="sections-toolbar">
              <div>
                <h2>{t("Video sections")}</h2>
                <p className="muted">
                  {sectionIds.length} {t("sections")} ·{" "}
                  {t("Introduction, reading and closing")}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  className={`icon-button section-toolbar-button${project.published ? " project-published-button" : ""}`}
                  aria-label={t(
                    project.published
                      ? "Mark as unpublished"
                      : "Mark as published",
                  )}
                  data-tooltip={t(
                    project.published
                      ? "Mark as unpublished"
                      : "Mark as published",
                  )}
                  aria-pressed={Boolean(project.published)}
                  disabled={locked}
                  onClick={() =>
                    void perform(async () => {
                      await api(endpoint(), {
                        method: "PATCH",
                        body: JSON.stringify({ published: !project.published }),
                      });
                    })
                  }
                >
                  <CircleCheck size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button section-toolbar-button"
                  aria-label={t("Generate all missing narrations")}
                  data-tooltip={t(
                    queuingVoices
                      ? "Adding narrations to the queue…"
                      : voicesLoaded && analysis && !missingNarrations.length
                        ? "All narrations are ready or queued"
                        : "Generate all missing narrations",
                  )}
                  disabled={
                    taskQueueLocked ||
                    queuingVoices ||
                    narrationParts.some((part) =>
                      pendingTasks.has(`voice:${part}`),
                    ) ||
                    analyzing ||
                    !analysis ||
                    !voicesLoaded ||
                    !missingNarrations.length
                  }
                  onClick={() => void generateMissingVoices()}
                >
                  {queuingVoices ? (
                    <LoaderCircle size={17} className="voice-spinner" />
                  ) : (
                    <WandSparkles size={17} />
                  )}
                </button>
                <button
                  type="button"
                  className="icon-button section-toolbar-button"
                  aria-label={t("Analyze all readings with AI")}
                  data-tooltip={t(
                    "Analyze all readings with AI. Manual verse adjustments are preserved.",
                  )}
                  disabled={
                    taskQueueLocked ||
                    analyzing ||
                    !analysis ||
                    alignmentScopeBusy() ||
                    analysis?.sections.every(
                      (section) => section.originalAvailable === false,
                    )
                  }
                  onClick={() => void queueAlignment()}
                >
                  <ScanText size={17} />
                </button>
                <span className="section-action-separator" aria-hidden="true" />
                <button
                  type="button"
                  aria-label={t("Expand all")}
                  onClick={() => setExpanded(new Set(sectionIds))}
                >
                  <ChevronsDown size={16} />
                </button>
                <button
                  type="button"
                  aria-label={t("Collapse all")}
                  onClick={() => setExpanded(new Set())}
                >
                  <ChevronsUp size={16} />
                </button>
              </div>
            </div>
            {voiceSection("intro", 1)}
            {timeline.length ? (
              timeline.map((section) => {
                const id = `reading-${section.index}`;
                const verses = cues.filter((cue, index) => {
                  const baseline = analysis!.cues[index];
                  return (
                    baseline.start >= section.timelineStart - 0.0001 &&
                    baseline.start < section.timelineEnd - 0.0001
                  );
                });
                const sectionJob = alignmentJobs.find(
                  (job) =>
                    ["queued", "running"].includes(job.status) &&
                    (job.sectionIndex === undefined ||
                      job.sectionIndex === section.index),
                );
                const sectionApplying =
                  applyingAlignment &&
                  (applyingAlignment.sectionIndex === undefined ||
                    applyingAlignment.sectionIndex === section.index);
                return (
                  <div key={id} style={{ display: "contents" }}>
                    {kind !== "short" &&
                      analysis?.chapterIntroductions?.[section.index] &&
                      voiceSection(
                        analysis.chapterIntroductions[section.index].part,
                        section.index * 2 + 2,
                      )}
                    <section className="section-card">
                      {sectionHeading(
                        id,
                        kind !== "short"
                          ? section.index * 2 + 3
                          : section.index + 2,
                        `${t("Passage reading")} ${timeline.length > 1 ? section.index + 1 : ""}`,
                        `${verses.length} ${t("verses")} · ${(section.end - section.start).toFixed(1)} s`,
                        false,
                        verses.map((cue) => cue.reference),
                      )}
                      {(sectionJob || sectionApplying) && (
                        <GenerationProgress
                          value={sectionJob?.progress ?? 100}
                          label={t(
                            sectionApplying
                              ? "Applying analyzed timings…"
                              : sectionJob?.status === "queued"
                                ? "Timing analysis is queued"
                                : "Analyzing reading timings…",
                          )}
                        />
                      )}
                      <div
                        id={`section-${id}`}
                        hidden={!expanded.has(id)}
                        className="section-body"
                      >
                        {settings.alignmentReviewReferences?.some((reference) =>
                          verses.some((cue) => cue.reference === reference),
                        ) && (
                          <p className="notice">
                            {t(
                              "Listen carefully to these verse cuts: {references}",
                            ).replace(
                              "{references}",
                              settings.alignmentReviewReferences
                                .filter((reference) =>
                                  verses.some(
                                    (cue) => cue.reference === reference,
                                  ),
                                )
                                .join(", "),
                            )}
                          </p>
                        )}
                        <VerseWaveform
                          selectedReference={
                            activeVerse?.project === base &&
                            activeVerse.section === section.index
                              ? activeVerse.reference
                              : undefined
                          }
                          onSelectReference={(reference) =>
                            selectVerse({ section: section.index, reference })
                          }
                          editableVerseText={Boolean(
                            settings.readingVoices?.[section.index]?.enabled ||
                            section.originalAvailable === false,
                          )}
                          textOnly={section.originalAvailable === false}
                          toolbarActions={
                            <>
                              <span
                                className="waveform-volume-indicator"
                                data-tooltip={`${t("Automatic volume")}: ${loudnessTarget} LUFS`}
                                aria-label={`${t("Automatic volume")}: ${loudnessTarget} LUFS`}
                              >
                                <Volume2 size={16} aria-hidden="true" />
                                {loudnessTarget} LUFS
                              </span>
                              <span
                                className="section-action-separator"
                                aria-hidden="true"
                              />
                            </>
                          }
                          resourceKey={`${base}:${loudnessTarget}:${id}`}
                          onPrepared={onWaveformPrepared}
                          expanded={expanded.has(id)}
                          resetRevision={readingResetRevisions[id] ?? 0}
                          locale={project.locale}
                          src={media(id)}
                          sourceStart={section.start}
                          sourceEnd={section.end}
                          sourceDuration={section.sourceDuration ?? section.end}
                          onExpand={(edge) =>
                            expandSection(section.index, edge)
                          }
                          timelineStart={section.timelineStart}
                          volumeMultiplier={1}
                          cues={verses}
                          disabled={
                            readingLocks(section.index).editingLocked ||
                            analyzing
                          }
                          onTrim={trim}
                          preservedReferences={verses
                            .filter((cue) =>
                              verseHasSavedCuts(
                                settings.verseOffsets,
                                cue.reference,
                              ),
                            )
                            .map((cue) => cue.reference)}
                          onShift={(cue, manuallyAdjusted) =>
                            shiftVerse(section.index, cue, manuallyAdjusted)
                          }
                        >
                          {(cue, selectReference, pronunciation) =>
                            generatedReading(
                              section.index,
                              cue.reference,
                              selectReference,
                              pronunciation,
                            )
                          }
                        </VerseWaveform>
                        {sectionVisuals(
                          id,
                          verses.map((cue) => cue.reference),
                        )}
                      </div>
                    </section>
                  </div>
                );
              })
            ) : (
              <section className="section-card">
                {sectionHeading(
                  "reading-0",
                  2,
                  t("Passage reading"),
                  analyzing
                    ? t("Loading audio and verses…")
                    : t("Prepare the audio to adjust timing"),
                )}
                <div
                  id="section-reading-0"
                  hidden={!expanded.has("reading-0")}
                  className="section-body"
                >
                  <div className="reading-loading">
                    <AudioLines size={36} />
                    <h3>
                      {analyzing
                        ? t("Loading audio and verses…")
                        : t("Passage synchronization")}
                    </h3>
                    <p className="muted">
                      {t(
                        "Listen to the passage and adjust timing on its waveform here.",
                      )}
                    </p>
                  </div>
                  {sectionVisuals("reading-0")}
                </div>
              </section>
            )}
            {analysisError && (
              <p className="error" role="alert">
                {t(analysisError)}
              </p>
            )}
            {voiceSection("outro", sectionIds.length)}
          </div>
          {result?.descriptions && (
            <div className="project-studio-details">
              <details className="panel studio-history">
                <summary>{t("Publication texts")}</summary>
                {!Object.keys(result.descriptions).length && (
                  <p className="muted">
                    {t(
                      "No publication texts were generated because this environment has no publication templates for this format and language. Add them in Settings before generating the video again.",
                    )}
                  </p>
                )}
                {Object.entries(result.descriptions)
                  .sort(([left], [right]) => {
                    const order = [
                      "instagram",
                      "facebook",
                      "youtube",
                      "tiktok",
                      "x",
                    ];
                    return (
                      order.indexOf(
                        left.replace(/^\d+-/, "").replace(/\.txt$/, ""),
                      ) -
                      order.indexOf(
                        right.replace(/^\d+-/, "").replace(/\.txt$/, ""),
                      )
                    );
                  })
                  .map(([name, text]) => (
                    <label key={name}>
                      {(
                        {
                          "youtube.txt": "YouTube",
                          "instagram.txt": "Instagram",
                          "tiktok.txt": "TikTok",
                          "x.txt": "X",
                          "facebook.txt": "Facebook",
                        } as Record<string, string>
                      )[name.replace(/^\d+-/, "")] || t("social media")}
                      <textarea readOnly rows={5} value={String(text)} />
                    </label>
                  ))}
              </details>
            </div>
          )}
        </div>
        {previewOpen && (
          <VideoProjectPreviewModal
            kind={kind}
            readingTitle={
              previewReading?.title ??
              (previewVoice
                ? previewVoice.startsWith("chapter-")
                  ? analysis?.chapterIntroductions?.find(
                      (chapter) => chapter.part === previewVoice,
                    )?.title
                  : t(previewVoice === "intro" ? "Introduction" : "Closing")
                : undefined)
            }
            view={previewView}
            onViewChange={(view) => {
              if (view === previewView) return;
              previewPlayback.current?.stop();
              setPreviewView(view);
            }}
            close={() => {
              previewPlayback.current?.dispose();
              setPreviewOpen(false);
            }}
          >
            <VideoProjectPreview
              key={projectId + ":" + voiceRevision}
              kind={kind}
              endpoint={endpoint}
              media={media}
              settings={{ ...settings, loudnessTarget }}
              videoLocale={project.locale as "en" | "es" | "pt"}
              visualSectionId={previewVoice ?? previewReading?.sectionId}
              readingReferences={previewReading?.references}
              readingSources={analysis?.sections}
              readingCues={cues}
              voicePart={previewVoice ?? undefined}
              ready={Boolean(
                analysis &&
                !analyzing &&
                (previewReading ||
                  (previewVoice
                    ? voices[previewVoice]?.available
                    : voicesReady)),
              )}
              playbackRef={previewPlayback}
              view={previewView}
              rendered={Boolean(result)}
              onBackground={(background) =>
                setSettings((current) =>
                  current.background === background
                    ? current
                    : { ...current, background },
                )
              }
            />
            {result && !previewReading && !previewVoice && (
              <div className="preview-actions">
                {result.videoVariants ? (
                  <>
                    <a
                      className="button"
                      href={`${media("video-subscribe")}&download=1`}
                    >
                      <Download size={15} />
                      {t("YouTube video · Subscribe")}
                    </a>
                    <a
                      className="button"
                      href={`${media("video-follow")}&download=1`}
                    >
                      <Download size={15} />
                      {t("Other social networks · Follow")}
                    </a>
                  </>
                ) : (
                  <a className="button" href={`${media("video")}&download=1`}>
                    <Download size={15} />
                    {t("Video")}
                  </a>
                )}
                <a className="button" href={`${media("thumbnail")}&download=1`}>
                  <Download size={15} />
                  {t("Thumbnail")}
                </a>
              </div>
            )}
          </VideoProjectPreviewModal>
        )}
        <div ref={collapseSpace} aria-hidden="true" />
      </div>
    </>
  );
}
