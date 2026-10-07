"use client";
import { SyncVideoProjectsModal } from "./SyncVideoProjectsModal";
import { VideoProjectMenu } from "./VideoProjectMenu";
import { CreateVideoProjectModal } from "./CreateVideoProjectModal";
import { useI18n } from "../i18n/context";
import { userMessage } from "../lib/presentation";
import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Check,
  Clapperboard,
  Film,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, date } from "./api";
import { type VideoRow } from "./video-project";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
export function Videos({ kind }: { kind: "short" | "long" }) {
  const { t, language } = useI18n();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [rows, setRows] = useState<VideoRow[]>([]),
    [versions, setVersions] = useState<any[]>([]),
    [version, setVersion] = useState(searchParams.get("version") || "all"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
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
  }, [load]);
  const Icon = kind === "short" ? Clapperboard : Film;
  const projectHref = (row: VideoRow) =>
    `/${kind === "short" ? "short-videos" : "long-videos"}/${String(row.id)}`;
  const filtered = rows.filter(
    (r) =>
      (r.title + " " + r.id).toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || (filter === "used" ? Boolean(r.used) : !r.used)),
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
          <button
            type="button"
            className="primary"
            onClick={() => setCreateOpen(true)}
          >
            {t("Nuevo proyecto de video")}
          </button>
          <VideoProjectMenu
            onSettings={() => setSettingsOpen(true)}
            onSync={() => setSyncOpen(true)}
          />
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
          <strong>{rows.filter((r) => !r.used).length}</strong>
          <span>{t("Sin usar")}</span>
        </div>
        <div>
          <Check size={17} />
          <strong>{rows.filter((r) => r.used).length}</strong>
          <span>{t("Usados")}</span>
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
            <option value="all">{t("Todas las versiones")}</option>
            {versions
              .filter((v) => v.id !== null)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.locale.toUpperCase()} · {v.label}
                </option>
              ))}
          </select>
          <select
            aria-label={t("Filtrar uso")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("Todos los proyectos")}</option>
            <option value="used">{t("Usados")}</option>
            <option value="unused">{t("Sin usar")}</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("Proyecto de video")}</th>
                <th>{t("Uso")}</th>
                <th>{t("Actualizado")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(currentPage * 20, (currentPage + 1) * 20)
                .map((row, index) => (
                  <tr key={row.id}>
                    <td className="muted">
                      {String(currentPage * 20 + index + 1).padStart(3, "0")}
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
                            {row.locale.toUpperCase()} · {row.label}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api(`videos/${row.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ used: !row.used }),
                            });
                            await load();
                          } catch (cause) {
                            setError(userMessage(cause));
                          }
                        }}
                      >
                        {t(row.used ? "Usado" : "Sin usar")}
                      </button>
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
          {loading && <div className="empty">{t("Cargando proyectos…")}</div>}
          {!loading && !filtered.length && (
            <div className="empty">
              {t(
                rows.length === 0 &&
                  version === "all" &&
                  !query &&
                  filter === "all"
                  ? "Crea tu primer proyecto de video para comenzar."
                  : "No hay videos que coincidan con estos filtros.",
              )}
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
      {createOpen && (
        <CreateVideoProjectModal
          kind={kind}
          close={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      )}
      {syncOpen && (
        <SyncVideoProjectsModal
          kind={kind}
          selectedVersion={version}
          close={() => setSyncOpen(false)}
          onSynced={(id) => {
            setQuery("");
            setFilter("all");
            setPage(0);
            if (version === String(id)) void load();
            else setVersion(String(id));
          }}
        />
      )}
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
