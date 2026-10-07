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
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, date } from "./api";
import { type VideoRow } from "./video-project";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
export function Videos({ kind }: { kind: "short" | "long" }) {
  const { t, language } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncingExisting, setSyncingExisting] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [rows, setRows] = useState<VideoRow[]>([]),
    [versions, setVersions] = useState<any[]>([]),
    [version, setVersion] = useState(searchParams.get("version") || "all"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("unpublished"),
    [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(10),
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
  const syncExisting = async () => {
    if (syncingExisting) return;
    setSyncingExisting(true);
    setSyncNotice("");
    setError("");
    try {
      const result = await api<{
        updated: number;
        unchanged: number;
        skipped: number;
        total: number;
      }>(`videos/sync-existing?kind=${kind}`, { method: "POST" });
      setSyncNotice(
        result.total === 0
          ? t("No se encontraron proyectos existentes para sincronizar.")
          : `${t("Actualizados:")} ${result.updated} · ${t("Sin cambios:")} ${result.unchanged}${result.skipped ? ` · ${t("Omitidos:")} ${result.skipped}. ${t("Revisa que sus versiones estén registradas y sus datos estén completos. Los proyectos en generación se omiten hasta que terminen.")}` : ""}`,
      );
      await load();
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setSyncingExisting(false);
    }
  };
  const projectHref = (row: VideoRow) =>
    `/${kind === "short" ? "short-videos" : "long-videos"}/${String(row.id)}`;
  const filtered = rows.filter(
    (r) =>
      (r.title + " " + r.id).toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "published" ? Boolean(r.published) : !r.published)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
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
            onSyncExisting={() => void syncExisting()}
            syncingExisting={syncingExisting}
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
          <strong>{rows.filter((r) => !r.published).length}</strong>
          <span>{t("No publicados")}</span>
        </div>
        <div>
          <Check size={17} />
          <strong>{rows.filter((r) => r.published).length}</strong>
          <span>{t("Publicados")}</span>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {syncingExisting && (
        <p className="notice" role="status">
          {t("Sincronizando proyectos existentes…")}
        </p>
      )}
      {syncNotice && (
        <p className="success" role="status">
          {syncNotice}
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
            aria-label={t("Filtrar publicación")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("Todos los proyectos")}</option>
            <option value="published">{t("Publicados")}</option>
            <option value="unpublished">{t("No publicados")}</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("Proyecto de video")}</th>
                <th>{t("Versión bíblica")}</th>
                <th>{t("Publicación")}</th>
                <th>{t("Actualizado")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                .map((row) => (
                  <tr
                    key={row.id}
                    className="video-project-row"
                    tabIndex={0}
                    aria-label={`${t("Abrir proyecto")}: ${row.title}`}
                    onClick={(event) => {
                      if ((event.target as Element).closest("a, button"))
                        return;
                      router.push(projectHref(row));
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(projectHref(row));
                      }
                    }}
                  >
                    <td className="muted">{row.id}</td>
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
                    <td>{row.version_code.toUpperCase()}</td>
                    <td>
                      <button
                        type="button"
                        className={
                          row.published ? "project-published-button" : undefined
                        }
                        onClick={async () => {
                          try {
                            await api(`videos/${row.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                published: !row.published,
                              }),
                            });
                            await load();
                          } catch (cause) {
                            setError(userMessage(cause));
                          }
                        }}
                      >
                        {t(row.published ? "Publicado" : "No publicado")}
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
                rows.length === 0 && version === "all" && !query
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
            <label className="pagination-page-size">
              {t("Elementos por página")}
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Primera página")}
              title={t("Primera página")}
              disabled={currentPage === 0}
              onClick={() => setPage(0)}
            >
              <ChevronsLeft size={17} aria-hidden="true" />
            </button>
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
            <button
              type="button"
              className="icon-button"
              aria-label={t("Última página")}
              title={t("Última página")}
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(pages - 1)}
            >
              <ChevronsRight size={17} aria-hidden="true" />
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
