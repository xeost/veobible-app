"use client";
import { useI18n } from "../i18n/context";
import { userMessage } from "../lib/presentation";
import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Check,
  RefreshCw,
  Clapperboard,
  Film,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, date } from "./api";
import { type VideoRow, videoStatusLabels as labels } from "./video-project";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
export function Videos({ kind }: { kind: "short" | "long" }) {
  const { t, language } = useI18n();
  const searchParams = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [rows, setRows] = useState<VideoRow[]>([]),
    [versions, setVersions] = useState<any[]>([]),
    [version, setVersion] = useState(searchParams.get("version") || "rv1909"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const data = await api(`videos?kind=${kind}&version=${version}`);
      setRows(data.videos);
      setLoading(false);
    } catch (e) {
      setError(userMessage(e));
      setLoading(false);
    }
  }, [kind, version]);
  useEffect(() => {
    void api("auth/me")
      .then((data) => setCanEditSettings(data.user.role === "admin"))
      .catch(() => {});
    void api("versions")
      .then((d) => setVersions(d.versions))
      .catch((e) => setError(userMessage(e)));
  }, []);
  useEffect(() => {
    setLoading(true);
    setPage(0);
    void load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);
  const Icon = kind === "short" ? Clapperboard : Film;
  const projectHref = (row: VideoRow) =>
    `/${kind === "short" ? "short-videos" : "long-videos"}/${encodeURIComponent(row.id)}?version=${encodeURIComponent(version)}`;
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
            {t(
              kind === "short"
                ? "DAILY DOSE · VERTICAL"
                : "365 DÍAS · HORIZONTAL",
            )}
          </p>
          <h1>{t(kind === "short" ? "Short Videos" : "Long Videos")}</h1>
          <p className="muted">
            {t(
              kind === "short"
                ? "Pasajes que inspiran, un video a la vez."
                : "Un recorrido por toda la Biblia, en 365 episodios.",
            )}
          </p>
        </div>
        <div className="project-top-actions">
          <button type="button" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            {t("Settings")}
          </button>
          <button onClick={load}>
            <RefreshCw size={16} /> {t("Actualizar")}
          </button>
        </div>
      </div>
      <div className="video-summary">
        <div>
          <Icon size={21} />
          <strong>{rows.length}</strong>
          <span>{t(kind === "short" ? "pasajes" : "episodios")}</span>
        </div>
        <div>
          <span className="dot green" />
          <strong>{rows.filter((r) => r.status === "ready").length}</strong>
          <span>{t("generados")}</span>
        </div>
        <div>
          <Check size={17} />
          <strong>{rows.filter((r) => r.published_at).length}</strong>
          <span>{t("publicados")}</span>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <section className="panel catalog-panel">
        <div className="catalog-toolbar">
          <div className="search">
            <Search size={17} />
            <input
              aria-label={t("Buscar pasaje")}
              placeholder={t("Buscar un pasaje o episodio…")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label={t("Versión bíblica")}
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
            aria-label={t("Filtrar estado")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("Todos los estados")}</option>
            {Object.entries(labels).map(([id, label]) => (
              <option value={id} key={id}>
                {t(label)}
              </option>
            ))}
            <option value="published">{t("Publicados")}</option>
            <option value="unpublished">{t("Sin publicar")}</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("Proyecto de video")}</th>
                <th>{t("Estado")}</th>
                <th>{t("Publicación")}</th>
                <th>{t("Actualizado")}</th>
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
                      <Link
                        className="button project-name"
                        href={projectHref(row)}
                      >
                        <span className={`video-icon ${kind}`}>
                          <Icon size={19} />
                        </span>
                        <span>
                          {row.title}
                          <small>
                            {t(kind === "short" ? "Daily Dose" : "365 Days")} ·{" "}
                            {version.toUpperCase()}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${row.status}`}>
                        <span className="dot" />
                        {t(labels[row.status])}
                      </span>
                    </td>
                    <td>
                      {row.published_at ? (
                        <span className="published">
                          <Check size={14} /> {t("Publicado")}
                        </span>
                      ) : (
                        <span className="muted">
                          {t(
                            row.used_at
                              ? "Usado anteriormente"
                              : "Sin publicar",
                          )}
                        </span>
                      )}
                    </td>
                    <td className="muted">{date(row.updated_at, language)}</td>
                    <td>
                      <Link
                        className="button icon-button"
                        aria-label={`${t("Abrir proyecto")}: ${row.title}`}
                        href={projectHref(row)}
                      >
                        <ArrowRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {loading && <div className="empty">{t("Cargando catálogo…")}</div>}
          {!loading && !filtered.length && (
            <div className="empty">
              {t("No hay videos que coincidan con estos filtros.")}
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filtered.length} {t("proyectos · página")} {currentPage + 1}{" "}
            {t("de")} {pages}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label={t("Página anterior")}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label={t("Página siguiente")}
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {settingsOpen && (
        <VoiceSettingsModal
          kind={kind}
          canEdit={canEditSettings}
          close={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
