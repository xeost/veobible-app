"use client";
import type { VoicePart } from "../../../../tools/video-project-api/src/chapter-introductions";
import { pollWhileVisible } from "../lib/visible-polling";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  ChevronLeft,
  ChevronDown,
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
} from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  userMessage,
  generationStage,
  voiceFailureMessage,
} from "../lib/presentation";
import { effectiveReadingVolume } from "../lib/project-settings";
import { settingsSchema, type RenderRequest } from "../lib/video-schema";
import { type VideoRow, type VideoKind } from "./video-project";
import {
  adjustedCues,
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
import { GenerationProgress } from "./GenerationProgress";
import { expandReadingContext } from "../../../../tools/video-project-api/src/reading-timeline";
import { VerseWaveform } from "./VerseWaveform";
import { queueChangedEvent } from "../lib/generation-queue";
type Settings = RenderRequest["settings"];
type VoiceState = {
  available: boolean;
  status: string;
  failureReason?: string;
  progress?: number;
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
  const { t } = useI18n();
  const [project, setProject] = useState<VideoRow | null>(null);
  const [settings, setSettings] = useState<Settings>(settingsSchema.parse({}));
  const [versionVolume, setVersionVolume] = useState(1);
  const readingVolumeValue = effectiveReadingVolume(settings, versionVolume);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [analysis, setAnalysis] = useState<Inspection | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVoice, setPreviewVoice] = useState<VoicePart | null>(null);
  const [previewReading, setPreviewReading] = useState<{
    references: string[];
    title: string;
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
  const [queuingVoices, setQueuingVoices] = useState(false);
  const [voiceRevision, setVoiceRevision] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [playingVoice, setPlayingVoice] = useState<VoicePart | null>(null);
  const voicePlayers = useRef<Partial<Record<VoicePart, HTMLAudioElement>>>({});
  const projectState = useRef(project);
  projectState.current = project;
  const voiceState = useRef(voices);
  voiceState.current = voices;
  const base = `videos/${encodeURIComponent(projectId)}?kind=${kind}`;
  const endpoint = useCallback(
    (action = "") =>
      `videos/${encodeURIComponent(projectId)}${action ? `/${action}` : ""}?kind=${kind}`,
    [projectId, kind],
  );
  const backHref = `/${kind === "short" ? "short-videos" : "long-videos"}`;
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
    setExpanded(new Set());
    setPreviewOpen(false);
    setPreviewReading(null);
    setPreviewVoice(null);
    setPreviewView("composition");
    setPlayingVoice(null);
    for (const player of Object.values(voicePlayers.current)) player?.pause();
  }, [base]);
  const inspect = useCallback(
    async (values: Settings) => {
      setAnalyzing(true);
      setAnalysisError("");
      try {
        // Always retain baseline estimates. Offsets are applied locally and saved for rendering.
        const data = await api<Inspection>(endpoint("analyze"), {
          method: "POST",
          body: JSON.stringify({ ...values, verseOffsets: [] }),
        });
        setAnalysis(data);
      } catch (cause) {
        setAnalysisError(userMessage(cause));
      } finally {
        setAnalyzing(false);
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
          video: VideoRow;
          defaults: Settings;
          mediaAccess: NonNullable<typeof mediaAccess>;
        }>(base);
        if (!live) return;
        setMediaAccess((current) =>
          current && current.expiresAt > Date.now() + 15 * 60 * 1000
            ? current
            : data.mediaAccess,
        );
        setVersionVolume(data.defaults.volumeMultiplier);
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
  const active = Boolean(
    project && ["queued", "running"].includes(project.status),
  );
  const voicesReady =
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
  ];
  const missingNarrations = narrationParts.filter(
    (part) =>
      !voices[part]?.available &&
      !["queued", "running"].includes(voices[part]?.status ?? ""),
  );
  const narrationRequirement =
    kind === "long"
      ? "Generate all section narrations before generating the video."
      : "Generate the introduction and closing voices before generating the video.";
  const editingLocked = busy || active;
  const locked = editingLocked;
  const timeline = readingTimeline(analysis?.sections ?? []);
  const cues = adjustedCues(analysis?.cues ?? [], settings.verseOffsets);
  const result = project?.result ? JSON.parse(project.result) : null;
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      const data = await api<{ video: VideoRow }>(base);
      setProject(data.video);
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(false);
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
    setSaved(true);
  };
  const trim = (reference: string, edge: "start" | "end", value: number) => {
    const original = analysis?.cues.find((cue) => cue.reference === reference);
    if (!original) return;
    setSettings((current) => {
      const old = current.verseOffsets.find(
        (offset) => offset.reference === reference,
      ) ?? { reference, startOffsetSeconds: 0, endOffsetSeconds: 0 };
      const next = {
        ...old,
        [edge === "start" ? "startOffsetSeconds" : "endOffsetSeconds"]:
          value - original[edge],
      };
      return {
        ...current,
        verseOffsets: [
          ...current.verseOffsets.filter(
            (offset) => offset.reference !== reference,
          ),
          next,
        ],
      };
    });
    setNotice("");
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
  const shiftVerse = (sectionIndex: number, cue: VerseCue) => {
    if (!analysis || editingLocked || analyzing) return false;
    const section = timeline[sectionIndex];
    const availableEnd =
      section.timelineStart +
      (section.sourceDuration ?? section.end) -
      section.start;
    if (cue.end > availableEnd + 1e-6) return false;
    // Expose enough original audio without moving this chapter's existing source cuts.
    if (cue.end > section.timelineEnd)
      expandSection(sectionIndex, "end", cue.end - section.timelineEnd);
    trim(cue.reference, "start", cue.start);
    trim(cue.reference, "end", cue.end);
    return true;
  };
  const queueVoice = async (part: VoicePart) => {
    await api(endpoint("voices"), {
      method: "POST",
      body: JSON.stringify({ part }),
    });
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
  const generateVoice = (part: VoicePart) =>
    perform(async () => {
      stopVoicePlayback();
      await queueVoice(part);
    });
  const generateMissingVoices = () =>
    perform(async () => {
      setQueuingVoices(true);
      stopVoicePlayback();
      try {
        // Recheck shared chapter recordings and pending work before adding anything.
        const current = await api<{ voices: Voices }>(endpoint("voices"));
        setVoices(current.voices);
        for (const part of narrationParts) {
          const voice = current.voices[part];
          if (
            !voice?.available &&
            !["queued", "running"].includes(voice?.status ?? "")
          )
            await queueVoice(part);
        }
      } finally {
        setQueuingVoices(false);
      }
    });
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
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleFromHeading = (id: string, event: MouseEvent<HTMLElement>) => {
    if (!(event.target as Element).closest("button")) toggle(id);
  };
  const sectionIds = [
    "intro",
    ...(timeline.length
      ? timeline.flatMap((section) =>
          kind === "long"
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
          disabled={analyzing || locked}
          onClick={() => void inspect(settings)}
        >
          {analyzing ? (
            <LoaderCircle size={16} className="voice-spinner" />
          ) : (
            <AudioWaveform size={17} />
          )}
        </button>
        <span className="section-action-separator" aria-hidden="true" />
        <button
          type="button"
          className="icon-button section-preview-button"
          aria-label={t("Preview this passage")}
          data-tooltip={t("Preview this passage")}
          aria-haspopup="dialog"
          disabled={analyzing || !readingReferences.length}
          onClick={() => {
            setPreviewReading({ references: readingReferences, title });
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
  const voiceSection = (part: VoicePart, number: number) => {
    const voice = voices[part] ?? { available: false, status: "idle" };
    const pending = ["queued", "running"].includes(voice.status);
    const chapter = analysis?.chapterIntroductions?.find(
      (item) => item.part === part,
    );
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
    return (
      <section className="section-card" key={part}>
        <div
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
              disabled={editingLocked || pending || !analysis}
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
            <p>
              {(chapter?.script ??
                (part === "intro" || part === "outro"
                  ? analysis?.scripts[part]
                  : undefined)) ||
                t("The script will appear once the passage loads.")}
            </p>
            <span className="muted">
              {t(
                "The script and presentation of this section are defined for this format.",
              )}
            </span>
          </div>
          <div className="narration-preview">
            <div className="section-preview-icon">
              <Mic size={26} />
            </div>
            <h3>{t("Narration preview")}</h3>
            {voice.available && !pending ? (
              <audio
                ref={(player) => {
                  if (player) voicePlayers.current[part] = player;
                  else delete voicePlayers.current[part];
                }}
                key={`${part}-${voice.status}-${voiceRevision}`}
                controls
                preload="metadata"
                src={`${media(part)}&revision=${voiceRevision}`}
                onPlay={() => {
                  Object.entries(voicePlayers.current).forEach(
                    ([key, player]) => {
                      if (key !== part) player?.pause();
                    },
                  );
                  setPlayingVoice(part);
                }}
                onPause={() =>
                  setPlayingVoice((current) =>
                    current === part ? null : current,
                  )
                }
                onEnded={() =>
                  setPlayingVoice((current) =>
                    current === part ? null : current,
                  )
                }
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
            <button
              type="button"
              className="primary"
              disabled={editingLocked || pending || !analysis}
              onClick={() => void generateVoice(part)}
            >
              <WandSparkles size={16} />
              {pending
                ? t("Preparing narration…")
                : voice.available
                  ? t("Regenerate narration")
                  : t("Generate narration")}
            </button>
          </div>
        </div>
      </section>
    );
  };
  const readingVolume = (
    <div className="reading-volume-settings">
      <hr className="reading-settings-divider" />
      <label>
        {t("Reading volume")}
        <div className="volume-control">
          <input
            type="range"
            min={0}
            max={4}
            step={0.1}
            value={readingVolumeValue}
            disabled={locked || !settings.overrideReadingVolume}
            onChange={(e) =>
              setSettings({
                ...settings,
                volumeMultiplier: Number(e.target.value),
              })
            }
          />
          <output>{readingVolumeValue.toFixed(2)}×</output>
        </div>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={settings.overrideReadingVolume}
          disabled={locked}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              overrideReadingVolume: event.target.checked,
            }))
          }
        />
        {t("Use a custom reading volume for this project")}
      </label>
      <p className="muted">
        {t(
          "Unchecked: uses the default reading volume for this Bible version.",
        )}
      </p>
      <hr className="reading-settings-divider" />
      <p className="muted">
        {t("Save synchronization changes before leaving.")}
      </p>
    </div>
  );
  if (!project)
    return (
      <section className="panel">
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
    );
  return (
    <>
      <div className="page-heading project-studio-heading">
        <div>
          <Link className="editor-back" href={backHref}>
            <ChevronLeft size={14} />
            {t("Back to projects")}
          </Link>
          <p className="eyebrow">
            {t("PROJECT EDITOR")} ·{" "}
            {(project?.version_code ?? "").toUpperCase()}
          </p>
          <h1>{project.title}</h1>
          <p className="muted">
            {t(
              "Prepare the narration and synchronize each verse with its audio.",
            )}
          </p>
        </div>
        <div className="project-top-actions">
          <button
            className={saved ? "save-confirmed" : undefined}
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
            data-tooltip={!voicesReady ? t(narrationRequirement) : undefined}
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
        </div>
      </div>
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
      {!voicesReady && <p className="muted">{t(narrationRequirement)}</p>}
      {notice && (
        <p className="success" role="status">
          {t(notice)}
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
                  editingLocked ||
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
              return (
                <div key={id} style={{ display: "contents" }}>
                  {kind === "long" &&
                    analysis?.chapterIntroductions?.[section.index] &&
                    voiceSection(
                      analysis.chapterIntroductions[section.index].part,
                      section.index * 2 + 2,
                    )}
                  <section className="section-card">
                    {sectionHeading(
                      id,
                      kind === "long"
                        ? section.index * 2 + 3
                        : section.index + 2,
                      `${t("Passage reading")} ${timeline.length > 1 ? section.index + 1 : ""}`,
                      `${verses.length} ${t("verses")} · ${(section.end - section.start).toFixed(1)} s`,
                      false,
                      verses.map((cue) => cue.reference),
                    )}
                    <div
                      id={`section-${id}`}
                      hidden={!expanded.has(id)}
                      className="section-body"
                    >
                      {expanded.has(id) && (
                        <VerseWaveform
                          src={media(id)}
                          sourceStart={section.start}
                          sourceEnd={section.end}
                          sourceDuration={section.sourceDuration ?? section.end}
                          onExpand={(edge) =>
                            expandSection(section.index, edge)
                          }
                          timelineStart={section.timelineStart}
                          volumeMultiplier={readingVolumeValue}
                          cues={verses}
                          disabled={editingLocked || analyzing}
                          onTrim={trim}
                          onShift={(cue) => shiftVerse(section.index, cue)}
                        />
                      )}
                      {readingVolume}
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
                {readingVolume}
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
            settings={settings}
            readingReferences={previewReading?.references}
            readingSources={analysis?.sections}
            readingCues={cues}
            voicePart={previewVoice ?? undefined}
            readingVolume={readingVolumeValue}
            ready={Boolean(
              analysis &&
              !analyzing &&
              (previewReading ||
                (previewVoice ? voices[previewVoice]?.available : voicesReady)),
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
              <a className="button" href={`${media("video")}&download=1`}>
                <Download size={15} />
                {t("Video")}
              </a>
              <a className="button" href={`${media("thumbnail")}&download=1`}>
                <Download size={15} />
                {t("Thumbnail")}
              </a>
            </div>
          )}
        </VideoProjectPreviewModal>
      )}
    </>
  );
}
