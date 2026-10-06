"use client";
import Link from "next/link";
import { useI18n } from "../i18n/context";
import {
  userMessage,
  statusLabel,
  generationStage,
  jobSummary,
} from "../lib/presentation";
import { useEffect, useState } from "react";
import {
  Play,
  Check,
  RefreshCw,
  Save,
  Download,
  SlidersHorizontal,
  ChevronLeft,
} from "lucide-react";
import { api, date } from "./api";
import { settingsSchema, type RenderRequest } from "../lib/video-schema";
import {
  type VideoRow,
  type VideoKind,
  videoStatusLabels as labels,
} from "./video-project";
type Settings = RenderRequest["settings"];
export function VideoProjectEditor({
  kind,
  catalogId,
  version,
}: {
  kind: VideoKind;
  catalogId: string;
  version: string;
}) {
  const { t, language } = useI18n();
  const [chosen, setChosen] = useState<VideoRow | null>(null);
  const [settings, setSettings] = useState<Settings>(settingsSchema.parse({}));
  const [offsets, setOffsets] = useState("[]");
  const [tab, setTab] = useState("settings");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const backHref = `/${kind === "short" ? "short-videos" : "long-videos"}?version=${encodeURIComponent(version)}`;
  const endpoint = (row: VideoRow, action = "") =>
    `videos/${encodeURIComponent(row.id)}${action ? "/" + action : ""}?version=${encodeURIComponent(version)}&kind=${kind}`;
  const load = async () => {
    const data = await api<{ video: VideoRow; defaults: Settings }>(
      `videos/${encodeURIComponent(catalogId)}?version=${encodeURIComponent(version)}&kind=${kind}`,
    );
    setChosen(data.video);
    return data;
  };
  useEffect(() => {
    let live = true;
    let initialized = false;
    const refresh = async () => {
      try {
        const data = await api<{ video: VideoRow; defaults: Settings }>(
          `videos/${encodeURIComponent(catalogId)}?version=${encodeURIComponent(version)}&kind=${kind}`,
        );
        if (!live) return;
        if (!initialized) {
          const values = settingsSchema.parse(
            data.video.settings && data.video.settings !== "{}"
              ? JSON.parse(data.video.settings)
              : data.defaults,
          );
          setSettings(values);
          setOffsets(JSON.stringify(values.verseOffsets, null, 2));
          initialized = true;
        }
        setChosen(data.video);
        setLoadError("");
      } catch (e) {
        if (live) setLoadError(userMessage(e));
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [catalogId, version, kind]);
  useEffect(() => {
    if (tab !== "history" || !chosen?.project_id) return;
    let live = true;
    const projectId = chosen.project_id;
    const refresh = async () => {
      try {
        const data = await api("jobs");
        if (live)
          setJobs(data.jobs.filter((job: any) => job.project_id === projectId));
      } catch (e) {
        if (live) setLoadError(userMessage(e));
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [tab, chosen?.project_id]);
  const active = chosen && ["queued", "running"].includes(chosen.status);
  const result = chosen?.result ? JSON.parse(chosen.result) : null;
  const values = () =>
    settingsSchema.parse({ ...settings, verseOffsets: JSON.parse(offsets) });
  const offsetFor = (reference: string) => {
    try {
      return (
        JSON.parse(offsets).find((v: any) => v.reference === reference) ?? {
          reference,
          startOffsetSeconds: 0,
          endOffsetSeconds: 0,
        }
      );
    } catch {
      return { reference, startOffsetSeconds: 0, endOffsetSeconds: 0 };
    }
  };
  const setVerseOffset = (reference: string, key: string, value: number) => {
    const entries = JSON.parse(offsets);
    const previous = entries.find((v: any) => v.reference === reference);
    if (previous) previous[key] = value;
    else entries.push({ ...offsetFor(reference), [key]: value });
    setOffsets(JSON.stringify(entries, null, 2));
  };
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!chosen)
    return (
      <section className="panel">
        <Link className="button" href={backHref}>
          <ChevronLeft size={16} />
          {t("Volver a los proyectos")}
        </Link>
        <p
          className={error || loadError ? "error" : "empty"}
          role={error || loadError ? "alert" : "status"}
        >
          {t(error || loadError || "Cargando proyecto…")}
        </p>
      </section>
    );
  return (
    <section className="panel project-editor">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {t(kind === "short" ? "DAILY DOSE" : "365 DAYS")} ·{" "}
            {version.toUpperCase()} ·{" "}
            {t(kind === "short" ? "Vertical · 9:16" : "Horizontal · 16:9")}
          </p>
          <h1>{chosen.title}</h1>
        </div>
        <Link className="button" href={backHref}>
          <ChevronLeft size={16} /> {t("Volver a los proyectos")}
        </Link>
      </div>
      <div className="tabs">
        {[
          ["settings", "Ajustes"],
          ["timing", "Pasaje y tiempos"],
          ["preview", "Video y publicación"],
          ["history", "Historial"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => {
              setTab(id);
            }}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {(error || loadError) && (
        <p className="error" role="alert">
          {t(error || loadError)}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {t(notice)}
        </p>
      )}
      {active && (
        <p className="notice">
          {t("Trabajo")} {t(labels[chosen.status]).toLowerCase()}
          {t(". Puedes salir de esta página; la generación continúa.")}
        </p>
      )}
      {tab === "settings" && (
        <div className="editor-content">
          <div className="editor-intro">
            <SlidersHorizontal size={22} />
            <div>
              <h3>{t("Configuración de producción")}</h3>
              <p className="muted">
                {t(
                  "Tus ajustes se conservan para volver a generar el video cuando lo necesites.",
                )}
              </p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              {t("Volumen de lectura")}
              <input
                type="number"
                min={0}
                max={4}
                step={0.05}
                disabled={!!active}
                value={settings.volumeMultiplier}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    volumeMultiplier: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              {t("Audio de introducción y cierre")}
              <select
                disabled={!!active}
                value={settings.clipAudioMode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    clipAudioMode: e.target.value as Settings["clipAudioMode"],
                  })
                }
              >
                <option value="voice">{t("Narración generada")}</option>
                <option value="mix">{t("Voz + audio del video")}</option>
                <option value="video">{t("Audio del video original")}</option>
              </select>
            </label>
            <label>
              {t("Ajuste de inicio del pasaje (segundos)")}
              <input
                disabled={!!active}
                type="number"
                step={0.01}
                value={settings.passageOffsets.startSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passageOffsets: {
                      ...settings.passageOffsets,
                      startSeconds: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              {t("Ajuste de fin del pasaje (segundos)")}
              <input
                disabled={!!active}
                type="number"
                step={0.01}
                value={settings.passageOffsets.endSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passageOffsets: {
                      ...settings.passageOffsets,
                      endSeconds: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>
          <label>
            {t("Video de fondo")}
            {analysis ? (
              <select
                disabled={!!active}
                value={settings.background ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    background: e.target.value || undefined,
                  })
                }
              >
                <option value="">{t("Seleccionar automáticamente")}</option>
                {analysis.backgrounds.map((v: string, index: number) => (
                  <option key={v} value={v}>
                    {t("Fondo")} {index + 1}
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <p className="muted">
                  {t(
                    settings.background
                      ? "Se usará el fondo seleccionado para este video."
                      : "El fondo se seleccionará automáticamente.",
                  )}
                </p>
                <button
                  disabled={busy || !!active}
                  onClick={() =>
                    perform(async () =>
                      setAnalysis(
                        await api(endpoint(chosen, "analyze"), {
                          method: "POST",
                          body: JSON.stringify(values()),
                        }),
                      ),
                    )
                  }
                >
                  {t("Elegir fondo")}
                </button>
              </div>
            )}
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              disabled={!!active}
              checked={settings.reuseVoices}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reuseVoices: e.target.checked,
                })
              }
            />{" "}
            {t("Reutilizar voces existentes (desmarca para regenerarlas)")}
          </label>
          <button
            disabled={busy || !!active}
            onClick={() =>
              perform(async () => {
                await api(`settings?kind=${kind}&version=${version}`, {
                  method: "PUT",
                  body: JSON.stringify(values()),
                });
                setNotice(
                  "Ajustes guardados como valores predeterminados para esta versión y formato.",
                );
              })
            }
          >
            {t("Guardar como predeterminados de versión")}
          </button>
        </div>
      )}
      {tab === "timing" && (
        <div className="editor-content">
          <button
            disabled={busy || !!active}
            onClick={() =>
              perform(async () =>
                setAnalysis(
                  await api(endpoint(chosen, "analyze"), {
                    method: "POST",
                    body: JSON.stringify(values()),
                  }),
                ),
              )
            }
          >
            <RefreshCw size={16} /> {t("Revisar texto y audio")}
          </button>
          <p className="muted">
            {t(
              "Revisa los cortes detectados y ajusta los tiempos de cada versículo.",
            )}
          </p>
          {analysis && (
            <>
              <div className="reading-preview">
                {analysis.sections.map((section: any, i: number) => (
                  <label key={i}>
                    {t("Audio de lectura · sección")} {i + 1} ·{" "}
                    {section.start.toFixed(2)}–{section.end.toFixed(2)} {t("s")}
                    <audio
                      controls
                      preload="none"
                      src={`/api/${endpoint(chosen, "media")}&asset=reading-${i}#t=${section.start},${section.end}`}
                    />
                  </label>
                ))}
              </div>
              <div className="passage-text">
                {analysis.text.map((v: any, i: number) => (
                  <p key={i} className={v.inPassage ? "" : "context"}>
                    <b>{v.reference}</b> {v.text}
                  </p>
                ))}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>{t("Versículo")}</th>
                    <th>{t("Inicio")}</th>
                    <th>{t("Fin")}</th>
                    <th>{t("Ajuste de inicio")}</th>
                    <th>{t("Ajuste de fin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.cues.map((v: any) => (
                    <tr key={v.reference}>
                      <td>{v.reference}</td>
                      <td>
                        {v.start.toFixed(3)} {t("s")}
                      </td>
                      <td>
                        {v.end.toFixed(3)} {t("s")}
                      </td>
                      <td>
                        <input
                          aria-label={`${v.reference} ajuste de inicio`}
                          disabled={busy || !!active}
                          type="number"
                          step={0.01}
                          value={offsetFor(v.reference).startOffsetSeconds}
                          onChange={(e) =>
                            setVerseOffset(
                              v.reference,
                              "startOffsetSeconds",
                              Number(e.target.value),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${v.reference} ajuste de fin`}
                          disabled={busy || !!active}
                          type="number"
                          step={0.01}
                          value={offsetFor(v.reference).endOffsetSeconds}
                          onChange={(e) =>
                            setVerseOffset(
                              v.reference,
                              "endOffsetSeconds",
                              Number(e.target.value),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details>
                <summary>{t("Guiones de voz")}</summary>
                {Object.entries(analysis.scripts).map(([key, value]) => (
                  <p key={key}>
                    <b>{t(key === "intro" ? "Introducción" : "Cierre")}</b>:{" "}
                    {String(value)}
                  </p>
                ))}
              </details>
            </>
          )}
        </div>
      )}
      {tab === "preview" && (
        <div className="editor-content">
          {result ? (
            <>
              <video
                controls
                preload="metadata"
                className={
                  kind === "short" ? "preview vertical" : "preview horizontal"
                }
                src={`/api/${endpoint(chosen, "media")}&asset=video`}
                onError={() =>
                  setNotice(
                    "El video no está disponible. Puedes volver a generarlo con tus ajustes guardados.",
                  )
                }
              />
              <div className="preview-actions">
                <a
                  className="button"
                  href={`/api/${endpoint(chosen, "media")}&asset=video&download=1`}
                >
                  <Download size={16} /> {t("Video")}
                </a>
                <a
                  className="button"
                  href={`/api/${endpoint(chosen, "media")}&asset=thumbnail&download=1`}
                >
                  <Download size={16} /> {t("Miniatura")}
                </a>
                <button
                  disabled={busy || !!active}
                  onClick={() =>
                    perform(async () => {
                      await api(endpoint(chosen), {
                        method: "PATCH",
                        body: JSON.stringify({
                          published: !chosen.published_at,
                        }),
                      });
                      setNotice(
                        chosen.published_at
                          ? "Marca de publicación eliminada."
                          : "Marcado como publicado.",
                      );
                    })
                  }
                >
                  <Check size={16} />
                  {t(
                    chosen.published_at
                      ? "Quitar publicación"
                      : "Marcar publicado",
                  )}
                </button>
              </div>
              {["intro", "outro"].map((asset) => (
                <label key={asset}>
                  {t("Voz de")}{" "}
                  {t(asset === "intro" ? "introducción" : "cierre")}
                  <audio
                    controls
                    preload="none"
                    src={`/api/${endpoint(chosen, "media")}&asset=${asset}`}
                  />
                </label>
              ))}
              {Object.entries(result.descriptions ?? {}).map(([name, text]) => (
                <label key={name}>
                  {t("Texto para")}{" "}
                  {(
                    {
                      "youtube.txt": "YouTube",
                      "instagram.txt": "Instagram",
                      "tiktok.txt": "TikTok",
                      "x.txt": "X",
                      "facebook.txt": "Facebook",
                    } as Record<string, string>
                  )[name] ?? "redes sociales"}
                  <textarea readOnly rows={4} value={String(text)} />
                </label>
              ))}
            </>
          ) : (
            <div className="empty">
              {t(
                "Genera el video para previsualizarlo y obtener los textos de publicación.",
              )}
            </div>
          )}
          <p className="muted">
            {t(
              "Marcar publicado registra el estado en el dashboard. Sube el archivo a tus redes desde tu laptop.",
            )}
          </p>
        </div>
      )}
      {tab === "history" && (
        <div className="editor-content">
          {jobs.length ? (
            jobs.map((job) => (
              <div className="job-card" key={job.id}>
                <div className="panel-heading">
                  <span className={`badge ${job.status}`}>
                    {t(statusLabel(job.status))}
                  </span>
                  <span className="muted">
                    {date(job.created_at, language)}
                  </span>
                </div>
                <p>{t(generationStage(job.stage, job.status))}</p>
                {job.error && (
                  <p className="error">{t(userMessage(job.error))}</p>
                )}
                <details>
                  <summary>{t("Ajustes y resultado")}</summary>
                  {(() => {
                    const summary = jobSummary(job);
                    return (
                      <div className="muted">
                        {summary.version && (
                          <p>
                            {t("Versión:")} {summary.version}
                          </p>
                        )}
                        {summary.volume !== null && (
                          <p>
                            {t("Volumen de lectura:")} {summary.volume}×
                          </p>
                        )}
                        {summary.voices && (
                          <p>
                            {t("Audio:")} {t(summary.voices)}
                          </p>
                        )}
                        {summary.duration !== null && (
                          <p>
                            {t("Duración del video:")}{" "}
                            {summary.duration.toFixed(1)} {t("segundos")}
                          </p>
                        )}
                        {!summary.version &&
                          summary.volume === null &&
                          !summary.voices &&
                          summary.duration === null && (
                            <p>{t("No hay más detalles disponibles.")}</p>
                          )}
                      </div>
                    );
                  })()}
                </details>
              </div>
            ))
          ) : (
            <p className="empty">
              {t("Sin trabajos de generación para este proyecto.")}
            </p>
          )}
        </div>
      )}
      <div className="project-editor-footer">
        <span className={`badge ${chosen.status}`}>
          {t(labels[chosen.status])}
        </span>
        <div>
          <button
            disabled={busy || !!active}
            onClick={() =>
              perform(async () => {
                await api(endpoint(chosen), {
                  method: "PATCH",
                  body: JSON.stringify({ settings: values() }),
                });
                setNotice("Ajustes guardados.");
              })
            }
          >
            <Save size={16} /> {t("Guardar")}
          </button>
          <button
            className="primary"
            disabled={busy || !!active}
            onClick={() =>
              perform(async () => {
                await api(endpoint(chosen, "render"), {
                  method: "POST",
                  body: JSON.stringify(values()),
                });
                setNotice("Video en espera de generación.");
              })
            }
          >
            <Play size={16} />
            {t(
              busy
                ? "Procesando…"
                : result
                  ? "Regenerar video"
                  : "Generar video",
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
