"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Play,
  Check,
  RefreshCw,
  Clapperboard,
  Film,
  X,
  Save,
  Download,
  SlidersHorizontal,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, date } from "./api";
import { settingsSchema, type RenderRequest } from "../lib/video-schema";
type Settings = RenderRequest["settings"];
type Row = {
  id: string;
  title: string;
  kind: string;
  position: number;
  project_id: string | null;
  status: string;
  settings: string | null;
  published_at: string | null;
  used_at?: string | null;
  result: string | null;
  updated_at: string | null;
};
const labels: Record<string, string> = {
  draft: "Pendiente",
  queued: "En cola",
  running: "Generando",
  ready: "Generado",
  failed: "Error",
};
export function Videos({ kind }: { kind: "short" | "long" }) {
  const [rows, setRows] = useState<Row[]>([]),
    [versions, setVersions] = useState<any[]>([]),
    [version, setVersion] = useState("rv1909"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<Row | null>(null),
    [settings, setSettings] = useState<Settings>(settingsSchema.parse({})),
    [offsets, setOffsets] = useState("[]"),
    [tab, setTab] = useState("settings"),
    [busy, setBusy] = useState(false),
    [analysis, setAnalysis] = useState<any>(null),
    [jobs, setJobs] = useState<any[]>([]),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const data = await api(`videos?kind=${kind}&version=${version}`);
      setRows(data.videos);
      setLoading(false);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }, [kind, version]);
  useEffect(() => {
    void api("versions")
      .then((d) => setVersions(d.versions))
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    setLoading(true);
    setPage(0);
    void load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);
  const chosen = selected
    ? (rows.find((r) => r.id === selected.id) ?? selected)
    : null;
  const active = chosen && ["queued", "running"].includes(chosen.status);
  const result = chosen?.result ? JSON.parse(chosen.result) : null;
  const Icon = kind === "short" ? Clapperboard : Film;
  const endpoint = (row: Row, action = "") =>
    `videos/${encodeURIComponent(row.id)}${action ? "/" + action : ""}?version=${version}`;
  const open = async (row: Row) => {
    setSelected(row);
    setTab("settings");
    setAnalysis(null);
    setError("");
    setNotice("");
    setJobs([]);
    try {
      const defaults = await api(`settings?kind=${kind}&version=${version}`);
      const values = settingsSchema.parse(
        row.settings && row.settings !== "{}"
          ? JSON.parse(row.settings)
          : defaults.settings,
      );
      setSettings(values);
      setOffsets(JSON.stringify(values.verseOffsets, null, 2));
    } catch (e) {
      setError(String(e));
    }
  };
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
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const filtered = rows.filter(
    (r) =>
      (r.title + " " + r.id).toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "published"
          ? r.published_at
          : filter === "unpublished"
            ? !r.published_at
            : r.status === filter)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages - 1);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {kind === "short"
              ? "DAILY DOSE · VERTICAL"
              : "365 DAYS · LANDSCAPE"}
          </p>
          <h1>{kind === "short" ? "Short Videos" : "Long Videos"}</h1>
          <p className="muted">
            {kind === "short"
              ? "Pasajes que inspiran, un video a la vez."
              : "Un recorrido por toda la Biblia, en 365 episodios."}
          </p>
        </div>
        <button onClick={load}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>
      <div className="video-summary">
        <div>
          <Icon size={21} />
          <strong>{rows.length}</strong>
          <span>{kind === "short" ? "pasajes" : "episodios"}</span>
        </div>
        <div>
          <span className="dot green" />
          <strong>{rows.filter((r) => r.status === "ready").length}</strong>
          <span>generados</span>
        </div>
        <div>
          <Check size={17} />
          <strong>{rows.filter((r) => r.published_at).length}</strong>
          <span>publicados</span>
        </div>
      </div>
      {error && !selected && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="panel catalog-panel">
        <div className="catalog-toolbar">
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Buscar pasaje"
              placeholder="Buscar un pasaje o episodio…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Versión bíblica"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.locale.toUpperCase()} · {v.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar estado"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(labels).map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
            <option value="published">Publicados</option>
            <option value="unpublished">Sin publicar</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog">
            <thead>
              <tr>
                <th>#</th>
                <th>Proyecto de video</th>
                <th>Estado</th>
                <th>Publicación</th>
                <th>Actualizado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(currentPage * 20, (currentPage + 1) * 20)
                .map((row) => (
                  <tr key={row.id}>
                    <td className="muted">
                      {String(row.position).padStart(3, "0")}
                    </td>
                    <td>
                      <button
                        className="project-name"
                        onClick={() => open(row)}
                      >
                        <span className={`video-icon ${kind}`}>
                          <Icon size={19} />
                        </span>
                        <span>
                          {row.title}
                          <small>
                            {kind === "short" ? "Daily Dose" : "365 Days"} ·{" "}
                            {version.toUpperCase()}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`badge ${row.status}`}>
                        <span className="dot" />
                        {labels[row.status]}
                      </span>
                    </td>
                    <td>
                      {row.published_at ? (
                        <span className="published">
                          <Check size={14} /> Publicado
                        </span>
                      ) : (
                        <span className="muted">
                          {row.used_at ? "Usado en CLI" : "Sin publicar"}
                        </span>
                      )}
                    </td>
                    <td className="muted">{date(row.updated_at)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Abrir ${row.title}`}
                        onClick={() => open(row)}
                      >
                        <ArrowRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {loading && <div className="empty">Cargando catálogo…</div>}
          {!loading && !filtered.length && (
            <div className="empty">
              No hay videos que coincidan con estos filtros.
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filtered.length} proyectos · página {currentPage + 1} de {pages}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Página anterior"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Página siguiente"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {selected && chosen && (
        <div className="modal-backdrop">
          <section
            className="modal studio-modal"
            role="dialog"
            aria-modal="true"
            aria-label={chosen.title}
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">
                  {kind === "short" ? "DAILY DOSE" : "365 DAYS"} ·{" "}
                  {version.toUpperCase()}
                </p>
                <h2>{chosen.title}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Cerrar editor"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
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
                    if (id === "history")
                      void api("jobs")
                        .then((d) =>
                          setJobs(
                            d.jobs.filter(
                              (j: any) => j.project_id === chosen.project_id,
                            ),
                          ),
                        )
                        .catch((e) => setError(String(e)));
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="success" role="status">
                {notice}
              </p>
            )}
            {active && (
              <p className="notice">
                Trabajo {labels[chosen.status].toLowerCase()}. Puedes cerrar el
                editor; el progreso se guarda en D1.
              </p>
            )}
            {tab === "settings" && (
              <div className="editor-content">
                <div className="editor-intro">
                  <SlidersHorizontal size={22} />
                  <div>
                    <h3>Configuración de producción</h3>
                    <p className="muted">
                      Los ajustes se guardan por pasaje y versión. Las voces se
                      conservan como archivos fuente.
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Volumen de lectura
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
                    Audio de intro y outro
                    <select
                      disabled={!!active}
                      value={settings.clipAudioMode}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          clipAudioMode: e.target
                            .value as Settings["clipAudioMode"],
                        })
                      }
                    >
                      <option value="voice">Voz generada con IA</option>
                      <option value="mix">Voz + audio del video</option>
                      <option value="video">Audio del video original</option>
                    </select>
                  </label>
                  <label>
                    Inicio del pasaje (offset, segundos)
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
                    Fin del pasaje (offset, segundos)
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
                  Video de fondo
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
                      <option value="">Seleccionar automáticamente</option>
                      {analysis.backgrounds.map((v: string) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled={!!active}
                      placeholder="Automático (o nombre del archivo .mp4)"
                      value={settings.background ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          background: e.target.value || undefined,
                        })
                      }
                    />
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
                  Reutilizar voces existentes (desmarca para regenerarlas)
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
                  Guardar como predeterminados de versión
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
                  <RefreshCw size={16} /> Analizar texto y audio local
                </button>
                <p className="muted">
                  Revisa los cortes detectados y ajusta los tiempos de cada
                  versículo.
                </p>
                {analysis && (
                  <>
                    <div className="reading-preview">
                      {analysis.sections.map((section: any, i: number) => (
                        <label key={i}>
                          Audio de lectura · sección {i + 1} ·{" "}
                          {section.start.toFixed(2)}–{section.end.toFixed(2)} s
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
                          <th>Versículo</th>
                          <th>Inicio</th>
                          <th>Fin</th>
                          <th>Offset inicio</th>
                          <th>Offset fin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.cues.map((v: any) => (
                          <tr key={v.reference}>
                            <td>{v.reference}</td>
                            <td>{v.start.toFixed(3)} s</td>
                            <td>{v.end.toFixed(3)} s</td>
                            <td>
                              <input
                                aria-label={`${v.reference} offset inicio`}
                                disabled={busy || !!active}
                                type="number"
                                step={0.01}
                                value={
                                  offsetFor(v.reference).startOffsetSeconds
                                }
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
                                aria-label={`${v.reference} offset fin`}
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
                      <summary>Guiones de voz</summary>
                      {Object.entries(analysis.scripts).map(([key, value]) => (
                        <p key={key}>
                          <b>{key}</b>: {String(value)}
                        </p>
                      ))}
                    </details>
                  </>
                )}
                <details>
                  <summary>Ajustes avanzados JSON</summary>
                  <label>
                    Ajustes por versículo (segundos)
                    <textarea
                      disabled={!!active}
                      rows={7}
                      value={offsets}
                      onChange={(e) => setOffsets(e.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <p className="muted">
                    Cada entrada usa reference, startOffsetSeconds y
                    endOffsetSeconds. El análisis valida solapamientos antes de
                    renderizar.
                  </p>
                </details>
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
                        kind === "short" ? "preview vertical" : "preview"
                      }
                      src={`/api/${endpoint(chosen, "media")}&asset=video`}
                      onError={() =>
                        setNotice(
                          "El render no está disponible en la laptop. Puedes regenerarlo desde los ajustes guardados.",
                        )
                      }
                    />
                    <div className="preview-actions">
                      <a
                        className="button"
                        href={`/api/${endpoint(chosen, "media")}&asset=video&download=1`}
                      >
                        <Download size={16} /> Video
                      </a>
                      <a
                        className="button"
                        href={`/api/${endpoint(chosen, "media")}&asset=thumbnail&download=1`}
                      >
                        <Download size={16} /> Miniatura
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
                        {chosen.published_at
                          ? "Quitar publicación"
                          : "Marcar publicado"}
                      </button>
                    </div>
                    {["intro", "outro"].map((asset) => (
                      <label key={asset}>
                        Voz {asset}
                        <audio
                          controls
                          preload="none"
                          src={`/api/${endpoint(chosen, "media")}&asset=${asset}`}
                        />
                      </label>
                    ))}
                    <p className="muted">Archivo local: {result.output}</p>
                    {Object.entries(result.descriptions ?? {}).map(
                      ([name, text]) => (
                        <label key={name}>
                          {name}
                          <textarea readOnly rows={4} value={String(text)} />
                        </label>
                      ),
                    )}
                  </>
                ) : (
                  <div className="empty">
                    Genera el video para previsualizarlo y obtener los textos de
                    publicación.
                  </div>
                )}
                <p className="muted">
                  Marcar publicado registra el estado en el dashboard. Sube el
                  archivo a tus redes desde tu laptop.
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
                          {job.status}
                        </span>
                        <span className="muted">{date(job.created_at)}</span>
                      </div>
                      <p>{job.stage}</p>
                      {job.error && <pre className="error">{job.error}</pre>}
                      <details>
                        <summary>Ajustes y resultado</summary>
                        <pre>
                          {JSON.stringify(
                            {
                              ...job,
                              snapshot: job.snapshot
                                ? JSON.parse(job.snapshot)
                                : null,
                              result: job.result
                                ? JSON.parse(job.result)
                                : null,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </div>
                  ))
                ) : (
                  <p className="empty">
                    Sin trabajos de generación para este proyecto.
                  </p>
                )}
              </div>
            )}
            <div className="modal-footer">
              <span className={`badge ${chosen.status}`}>
                {labels[chosen.status]}
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
                      setNotice("Ajustes guardados en D1.");
                    })
                  }
                >
                  <Save size={16} /> Guardar
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
                      setNotice("Trabajo enviado a la laptop.");
                    })
                  }
                >
                  <Play size={16} />
                  {busy
                    ? "Procesando…"
                    : result
                      ? "Regenerar video"
                      : "Generar video"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
