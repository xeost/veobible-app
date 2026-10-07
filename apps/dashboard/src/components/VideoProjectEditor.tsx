"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Mic,
  AudioLines,
  LockKeyhole,
  Play,
  Pause,
  LoaderCircle,
  Save,
  RefreshCw,
  Download,
  Check,
  Clock,
  Film,
  Clapperboard,
} from "lucide-react";
import { useI18n } from "../i18n/context";
import { api, date } from "./api";
import {
  userMessage,
  statusLabel,
  generationStage,
  voiceFailureMessage,
} from "../lib/presentation";
import { settingsSchema, type RenderRequest } from "../lib/video-schema";
import { type VideoRow, type VideoKind } from "./video-project";
import {
  adjustedCues,
  validVerseTimings,
  readingTimeline,
  type Inspection,
} from "../lib/video-timing";
import { VideoProjectPreview } from "./VideoProjectPreview";
import { GenerationProgress } from "./GenerationProgress";
import { VerseWaveform } from "./VerseWaveform";
import { queueChangedEvent } from "../lib/generation-queue";
type Settings = RenderRequest["settings"];
type VoiceState = {
  available: boolean;
  status: string;
  failureReason?: string;
  progress?: number;
};
type Voices = Record<"intro" | "outro", VoiceState>;
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
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [saved]);
  useEffect(() => {
    setSaved(false);
  }, [settings, projectId]);
  const [voices, setVoices] = useState<Voices>(emptyVoices);
  const [voiceRevision, setVoiceRevision] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [playingVoice, setPlayingVoice] = useState<"intro" | "outro" | null>(
    null,
  );
  const voicePlayers = useRef<
    Partial<Record<"intro" | "outro", HTMLAudioElement>>
  >({});
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
  const media = (asset: string) => `/api/${endpoint("media")}&asset=${asset}`;
  useEffect(() => {
    setExpanded(new Set());
    setPlayingVoice(null);
    for (const player of Object.values(voicePlayers.current)) player.pause();
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
        const data = await api<{ video: VideoRow; defaults: Settings }>(base);
        if (!live) return;
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
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (
        !document.hidden &&
        ["queued", "running"].includes(projectState.current?.status ?? "")
      )
        void refresh();
    }, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [base, inspect]);
  useEffect(() => {
    if (!project?.project_id) return;
    let live = true;
    const refresh = async () => {
      try {
        const data = await api<{ voices: Voices }>(endpoint("voices"));
        if (live) {
          setVoices(data.voices);
          setVoiceError("");
        }
      } catch (cause) {
        if (live) setVoiceError(userMessage(cause));
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (
        !document.hidden &&
        Object.values(voiceState.current).some((voice) =>
          ["queued", "running"].includes(voice.status),
        )
      )
        void refresh();
    }, 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [project?.project_id, endpoint]);
  const active = Boolean(
    project && ["queued", "running"].includes(project.status),
  );
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
        analysis.cues.at(-1)?.end ?? 0,
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
  const generateVoice = (part: "intro" | "outro") =>
    perform(async () => {
      for (const player of Object.values(voicePlayers.current)) player.pause();
      setPlayingVoice(null);
      await api(endpoint("voices"), {
        method: "POST",
        body: JSON.stringify({ part }),
      });
      setVoices((current) => ({
        ...current,
        [part]: { ...current[part], status: "queued", progress: 0 },
      }));
      setSettings((current) => ({
        ...current,
        clipAudioMode: "voice",
        reuseVoices: true,
      }));
      setVoiceRevision((value) => value + 1);
      window.dispatchEvent(new Event(queueChangedEvent));
    });
  const toggleVoicePlayback = async (part: "intro" | "outro") => {
    const player = voicePlayers.current[part];
    if (!player) return;
    if (!player.paused) {
      player.pause();
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
  const sectionIds = [
    "intro",
    ...(timeline.length
      ? timeline.map((section) => `reading-${section.index}`)
      : ["reading-0"]),
    "outro",
  ];
  const sectionHeading = (
    id: string,
    number: number,
    title: string,
    summary: string,
    voice = false,
  ) => (
    <button
      type="button"
      className="section-heading"
      aria-expanded={expanded.has(id)}
      aria-controls={`section-${id}`}
      onClick={() => toggle(id)}
    >
      <span className="section-number">{String(number).padStart(2, "0")}</span>
      <span className={`section-role ${voice ? "voice" : "reading"}`}>
        {voice ? <Mic size={15} /> : <AudioLines size={15} />}
        {voice ? t("Voice") : t("Reading")}
      </span>
      <span className="section-heading-text">
        <strong>{title}</strong>
        <small>{summary}</small>
      </span>
      {voice && <LockKeyhole size={15} aria-label={t("Fixed section")} />}
      <ChevronDown size={18} className={expanded.has(id) ? "expanded" : ""} />
    </button>
  );
  const voiceSection = (part: "intro" | "outro", number: number) => {
    const voice = voices[part];
    const pending = ["queued", "running"].includes(voice.status);
    const title = part === "intro" ? t("Introduction") : t("Closing");
    const generateLabel = pending
      ? t("Preparing narration…")
      : voice.available
        ? t("Regenerate narration")
        : t("Generate narration");
    const playLabel =
      playingVoice === part ? t("Pause narration") : t("Listen to narration");
    return (
      <section className="section-card" key={part}>
        <div className="voice-section-heading">
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
              title={generateLabel}
              disabled={editingLocked || pending || !analysis}
              onClick={() => void generateVoice(part)}
            >
              {pending ? (
                <LoaderCircle size={17} className="voice-spinner" />
              ) : voice.available ? (
                <RefreshCw size={17} />
              ) : (
                <Mic size={17} />
              )}
            </button>
            {voice.available && !pending && (
              <button
                type="button"
                aria-label={`${playLabel} · ${title}`}
                title={playLabel}
                onClick={() => void toggleVoicePlayback(part)}
              >
                {playingVoice === part ? (
                  <Pause size={17} />
                ) : (
                  <Play size={17} />
                )}
              </button>
            )}
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
              {analysis?.scripts[part] ||
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
                  voicePlayers.current[
                    part === "intro" ? "outro" : "intro"
                  ]?.pause();
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
              <Mic size={16} />
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
  const FormatIcon = kind === "short" ? Clapperboard : Film;
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
            className="primary"
            disabled={locked || !analysis || analyzing}
            onClick={() =>
              void perform(async () => {
                await api(endpoint("render"), {
                  method: "POST",
                  body: JSON.stringify(
                    settingsSchema.parse({
                      ...checkedSettings(),
                      clipAudioMode: "voice",
                    }),
                  ),
                });
                window.dispatchEvent(new Event(queueChangedEvent));
                setNotice("Video queued for generation.");
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
      {notice && (
        <p className="success" role="status">
          {t(notice)}
        </p>
      )}
      {active && (
        <p className="notice">
          {t(
            "The video is being created. You can leave this page; generation will continue.",
          )}
        </p>
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
                <section className="section-card" key={id}>
                  {sectionHeading(
                    id,
                    section.index + 2,
                    `${t("Passage reading")} ${timeline.length > 1 ? section.index + 1 : ""}`,
                    `${verses.length} ${t("verses")} · ${(section.end - section.start).toFixed(1)} s`,
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
                        timelineStart={section.timelineStart}
                        cues={verses}
                        disabled={editingLocked || analyzing}
                        onTrim={trim}
                      />
                    )}
                  </div>
                </section>
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
              </div>
            </section>
          )}
          {analysisError && (
            <p className="error" role="alert">
              {t(analysisError)}
            </p>
          )}
          <button
            className="analysis-retry"
            disabled={analyzing || locked}
            onClick={() => void inspect(settings)}
          >
            <RefreshCw size={16} />
            {analyzing
              ? t("Loading audio and verses…")
              : t("Analyze audio again")}
          </button>
          {voiceSection("outro", sectionIds.length)}
        </div>
        <aside className="project-studio-sidebar">
          <section className="panel project-preview-panel">
            <div className="panel-heading">
              <h3>{t("Video preview")}</h3>
              <span className="format-pill">
                <FormatIcon size={14} />
                {kind === "short" ? "9:16" : "16:9"}
              </span>
            </div>
            <VideoProjectPreview
              key={projectId + ":" + voiceRevision}
              kind={kind}
              endpoint={endpoint}
              settings={settings}
              cues={cues}
              ready={Boolean(
                analysis &&
                !analyzing &&
                voices.intro.available &&
                voices.outro.available &&
                !Object.values(voices).some((voice) =>
                  ["queued", "running"].includes(voice.status),
                ),
              )}
              rendered={Boolean(result)}
              onBackground={(background) =>
                setSettings((current) =>
                  current.background === background
                    ? current
                    : { ...current, background },
                )
              }
            />
            <span className={`badge ${project.status}`}>
              {t(statusLabel(project.status))}
            </span>
            {active && (
              <GenerationProgress
                value={project.progress ?? 0}
                label={t("Video generation")}
              />
            )}
            {result && (
              <div className="preview-actions">
                <a className="button" href={`${media("video")}&download=1`}>
                  <Download size={15} />
                  {t("Video")}
                </a>
                <a className="button" href={`${media("thumbnail")}&download=1`}>
                  <Download size={15} />
                  {t("Thumbnail")}
                </a>
                <button
                  disabled={locked}
                  onClick={() =>
                    void perform(async () => {
                      await api(endpoint(), {
                        method: "PATCH",
                        body: JSON.stringify({
                          published: !project.published,
                        }),
                      });
                      setNotice(
                        project.published
                          ? "Marked as unpublished."
                          : "Marked as published.",
                      );
                    })
                  }
                >
                  <Check size={15} />
                  {project.published
                    ? t("Mark as unpublished")
                    : t("Mark as published")}
                </button>
              </div>
            )}
          </section>
          <section className="panel studio-audio-settings">
            <h3>
              <AudioLines size={17} />
              {t("Audio settings")}
            </h3>
            <label>
              {t("Reading volume")}
              <div className="volume-control">
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={0.05}
                  value={settings.volumeMultiplier}
                  disabled={locked}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      volumeMultiplier: Number(e.target.value),
                    })
                  }
                />
                <output>{settings.volumeMultiplier.toFixed(2)}×</output>
              </div>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.reuseVoices}
                disabled={locked}
                onChange={(e) =>
                  setSettings({ ...settings, reuseVoices: e.target.checked })
                }
              />
              {t("Reuse existing voices (uncheck to generate them again)")}
            </label>
            <p className="muted">
              {t("Save synchronization changes before leaving.")}
            </p>
            {voiceError && (
              <p className="error" role="alert">
                {t(voiceError)}
              </p>
            )}
          </section>
          {result?.descriptions && (
            <details className="panel studio-history">
              <summary>{t("Publication texts")}</summary>
              {Object.entries(result.descriptions).map(([name, text]) => (
                <label key={name}>
                  {(
                    {
                      "youtube.txt": "YouTube",
                      "instagram.txt": "Instagram",
                      "tiktok.txt": "TikTok",
                      "x.txt": "X",
                      "facebook.txt": "Facebook",
                    } as Record<string, string>
                  )[name] || t("social media")}
                  <textarea readOnly rows={5} value={String(text)} />
                </label>
              ))}
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
