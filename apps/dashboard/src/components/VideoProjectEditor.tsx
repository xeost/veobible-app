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
import { VerseWaveform } from "./VerseWaveform";
import { queueChangedEvent } from "../lib/generation-queue";
type Settings = RenderRequest["settings"];
type VoiceState = {
  available: boolean;
  status: string;
  failureReason?: string;
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
  const { t, language } = useI18n();
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
        "Los tiempos de algunos versículos se superponen o están fuera del pasaje. Revisa los ajustes de inicio y fin.",
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
    setNotice("Ajustes guardados.");
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
        [part]: { ...current[part], status: "queued" },
      }));
      setSettings((current) => ({
        ...current,
        clipAudioMode: "voice",
        reuseVoices: true,
      }));
      setVoiceRevision((value) => value + 1);
      window.dispatchEvent(new Event(queueChangedEvent));
      setNotice(
        "La voz está en preparación. Puedes seguir revisando el proyecto.",
      );
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
        setVoiceError("No se pudo reproducir la voz. Vuelve a intentarlo.");
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
        {t(voice ? "Voz" : "Lectura")}
      </span>
      <span className="section-heading-text">
        <strong>{title}</strong>
        <small>{summary}</small>
      </span>
      {voice && <LockKeyhole size={15} aria-label={t("Sección fija")} />}
      <ChevronDown size={18} className={expanded.has(id) ? "expanded" : ""} />
    </button>
  );
  const voiceSection = (part: "intro" | "outro", number: number) => {
    const voice = voices[part];
    const pending = ["queued", "running"].includes(voice.status);
    const title = t(part === "intro" ? "Introducción" : "Cierre");
    const generateLabel = t(
      pending
        ? "Preparando voz…"
        : voice.available
          ? "Regenerar voz"
          : "Generar voz",
    );
    const playLabel = t(playingVoice === part ? "Pausar voz" : "Escuchar voz");
    return (
      <section className="section-card" key={part}>
        <div className="voice-section-heading">
          {sectionHeading(
            part,
            number,
            title,
            t(
              pending
                ? "Preparando voz…"
                : voice.available
                  ? "Voz lista para escuchar"
                  : "Genera la voz de esta sección",
            ),
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
        <div
          id={`section-${part}`}
          hidden={!expanded.has(part)}
          className="section-body voice-section-body"
        >
          <div className="narration-script">
            <p className="eyebrow">{t("Guión de narración")}</p>
            <p>
              {analysis?.scripts[part] ||
                t("El guión aparecerá al cargar el pasaje.")}
            </p>
            <span className="muted">
              {t(
                "El texto y la presentación de esta sección están definidos para este formato.",
              )}
            </span>
          </div>
          <div className="narration-preview">
            <div className="section-preview-icon">
              <Mic size={26} />
            </div>
            <h3>{t("Previsualización de voz")}</h3>
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
                  setVoiceError(
                    "No se pudo reproducir la voz. Vuelve a intentarlo.",
                  );
                }}
              />
            ) : (
              <p className="muted">
                {t(
                  pending
                    ? "La voz estará disponible aquí cuando termine la preparación."
                    : "Genera el audio para escuchar esta sección antes de crear el video.",
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
              {t(
                pending
                  ? "Preparando voz…"
                  : voice.available
                    ? "Regenerar voz"
                    : "Generar voz",
              )}
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
          {t("Volver a los proyectos")}
        </Link>
        <p
          className={error ? "error" : "empty"}
          role={error ? "alert" : "status"}
        >
          {t(error || "Cargando proyecto…")}
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
            {t("Volver a los proyectos")}
          </Link>
          <p className="eyebrow">
            {t("EDITOR DE PROYECTO")} ·{" "}
            {(project?.version_code ?? "").toUpperCase()}
          </p>
          <h1>{project.title}</h1>
          <p className="muted">
            {t("Prepara la voz y sincroniza cada versículo con su audio.")}
          </p>
        </div>
        <div className="project-top-actions">
          <button disabled={editingLocked} onClick={() => void perform(save)}>
            <Save size={16} />
            {t("Guardar cambios")}
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
                setNotice("Video en espera de generación.");
              })
            }
          >
            <Play size={16} />
            {t(
              active
                ? "Generando"
                : result
                  ? "Regenerar video"
                  : "Generar video",
            )}
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
            "El video se está creando. Puedes salir de esta página; la generación continúa.",
          )}
        </p>
      )}
      <div className="project-studio-layout">
        <div className="section-stack">
          <div className="sections-toolbar">
            <div>
              <h2>{t("Secciones del video")}</h2>
              <p className="muted">
                {sectionIds.length} {t("secciones")} ·{" "}
                {t("Introducción, lectura y cierre")}
              </p>
            </div>
            <div>
              <button
                type="button"
                aria-label={t("Expandir todas")}
                onClick={() => setExpanded(new Set(sectionIds))}
              >
                <ChevronsDown size={16} />
              </button>
              <button
                type="button"
                aria-label={t("Contraer todas")}
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
                    `${t("Lectura del pasaje")} ${timeline.length > 1 ? section.index + 1 : ""}`,
                    `${verses.length} ${t("versículos")} · ${(section.end - section.start).toFixed(1)} s`,
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
                t("Lectura del pasaje"),
                t(
                  analyzing
                    ? "Cargando audio y versículos…"
                    : "Prepara el audio para ajustar los tiempos",
                ),
              )}
              <div
                id="section-reading-0"
                hidden={!expanded.has("reading-0")}
                className="section-body"
              >
                <div className="reading-loading">
                  <AudioLines size={36} />
                  <h3>
                    {t(
                      analyzing
                        ? "Cargando audio y versículos…"
                        : "Sincronización del pasaje",
                    )}
                  </h3>
                  <p className="muted">
                    {t(
                      "Aquí podrás escuchar el pasaje y ajustar los tiempos sobre su forma de onda.",
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
            {t(
              analyzing
                ? "Cargando audio y versículos…"
                : "Volver a analizar el audio",
            )}
          </button>
          {voiceSection("outro", sectionIds.length)}
        </div>
        <aside className="project-studio-sidebar">
          <section className="panel project-preview-panel">
            <div className="panel-heading">
              <h3>{t("Previsualización del video")}</h3>
              <span className="format-pill">
                <FormatIcon size={14} />
                {kind === "short" ? "9:16" : "16:9"}
              </span>
            </div>
            {result ? (
              <video
                controls
                preload="metadata"
                className={`studio-video-preview ${kind}`}
                src={media("video")}
                onError={() =>
                  setError(
                    "El video no está disponible. Puedes volver a generarlo con tus ajustes guardados.",
                  )
                }
              />
            ) : (
              <div className={`studio-preview-placeholder ${kind}`}>
                <FormatIcon size={40} />
                <strong>
                  {t(kind === "short" ? "Video vertical" : "Video horizontal")}
                </strong>
                <span>
                  {t("El video aparecerá aquí después de generarlo.")}
                </span>
              </div>
            )}
            <span className={`badge ${project.status}`}>
              {t(statusLabel(project.status))}
            </span>
            {result && (
              <div className="preview-actions">
                <a className="button" href={`${media("video")}&download=1`}>
                  <Download size={15} />
                  {t("Video")}
                </a>
                <a className="button" href={`${media("thumbnail")}&download=1`}>
                  <Download size={15} />
                  {t("Miniatura")}
                </a>
                <button
                  disabled={locked}
                  onClick={() =>
                    void perform(async () => {
                      await api(endpoint(), {
                        method: "PATCH",
                        body: JSON.stringify({
                          used: !project.used,
                        }),
                      });
                      setNotice(
                        project.used
                          ? "Marca de uso eliminada."
                          : "Marcado como usado.",
                      );
                    })
                  }
                >
                  <Check size={15} />
                  {t(
                    project.used ? "Marcar como no usado" : "Marcar como usado",
                  )}
                </button>
              </div>
            )}
          </section>
          <section className="panel studio-audio-settings">
            <h3>
              <AudioLines size={17} />
              {t("Ajustes de audio")}
            </h3>
            <label>
              {t("Volumen de lectura")}
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
              {t("Reutilizar voces existentes (desmarca para regenerarlas)")}
            </label>
            <p className="muted">
              {t("Guarda los cambios de sincronización antes de salir.")}
            </p>
            {voiceError && (
              <p className="error" role="alert">
                {t(voiceError)}
              </p>
            )}
          </section>
          {result?.descriptions && (
            <details className="panel studio-history">
              <summary>{t("Textos de publicación")}</summary>
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
                  )[name] || t("redes sociales")}
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
