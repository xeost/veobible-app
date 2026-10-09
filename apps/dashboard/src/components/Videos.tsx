"use client";
import { UpdatedAt } from "./UpdatedAt";
import { SyncVideoProjectsModal } from "./SyncVideoProjectsModal";
import { VideoProjectMenu } from "./VideoProjectMenu";
import { CreateVideoProjectModal } from "./CreateVideoProjectModal";
import { useI18n } from "../i18n/context";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";
import type { BibleVersion } from "../lib/bible-versions";
import { userMessage, publicationLabel } from "../lib/presentation";
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
  Bookmark,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "./api";
import {
  parseCurrentProjects,
  type CurrentProjects,
  toggleCurrentProjectMark,
  projectVersionKey,
  currentProjectStorageKey as storageKey,
} from "../lib/current-video-projects";
import { type VideoRow } from "./video-project";
import { VoiceSettingsModal } from "./VoiceSettingsModal";

function versionFilter(value: string | null): string {
  return value === "all" ||
    (value !== null &&
      /^[1-9]\d*$/.test(value) &&
      Number.isSafeInteger(Number(value)))
    ? value
    : "all";
}
export function Videos({ kind }: { kind: "short" | "long" }) {
  const { t, language } = useI18n();
  const { orderVersions } = usePinnedBibleVersions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedVersion = searchParams.get("version");
  const versionStorageKey = `veo-video-version-filter:${kind}`;
  const currentProjectStorageKey = storageKey(kind);
  const [currentProjects, setCurrentProjects] = useState<CurrentProjects>({});
  useEffect(() => {
    const read = () => {
      try {
        setCurrentProjects(
          parseCurrentProjects(
            localStorage.getItem(currentProjectStorageKey),
            kind,
          ),
        );
      } catch {
        // The working mark remains usable when browser storage is unavailable.
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === currentProjectStorageKey || event.key === null) read();
    };
    read();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [currentProjectStorageKey, kind]);
  const isCurrentProject = (row: VideoRow) =>
    currentProjects[projectVersionKey(row)]?.includes(row.id) ?? false;
  const saveCurrentProjects = (next: CurrentProjects) => {
    setCurrentProjects(next);
    try {
      localStorage.setItem(currentProjectStorageKey, JSON.stringify(next));
    } catch {
      // Keep the mark for this visit if persistence is blocked.
    }
  };
  const toggleCurrentProject = (row: VideoRow) => {
    saveCurrentProjects(toggleCurrentProjectMark(currentProjects, row, kind));
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncingExisting, setSyncingExisting] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [rows, setRows] = useState<VideoRow[]>([]),
    [versions, setVersions] = useState<BibleVersion[]>([]),
    [version, setVersion] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("unpublished"),
    [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(10),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    if (version === null) return;
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
    // Preserve the previous format-wide mark once its project appears in the list.
    const legacyKey = `veo-current-video-project:${kind}`;
    try {
      const id = Number(localStorage.getItem(legacyKey));
      const row = rows.find((item) => item.id === id);
      if (!row) return;
      const key = projectVersionKey(row);
      if (currentProjects[key] === undefined) {
        const next = { ...currentProjects, [key]: [row.id] };
        localStorage.setItem(currentProjectStorageKey, JSON.stringify(next));
        setCurrentProjects(next);
      }
      localStorage.removeItem(legacyKey);
    } catch {
      // Migration is optional when local storage is unavailable.
    }
  }, [rows, kind, currentProjects, currentProjectStorageKey]);
  useEffect(() => {
    let next = versionFilter(requestedVersion);
    try {
      if (requestedVersion === null)
        next = versionFilter(localStorage.getItem(versionStorageKey));
      localStorage.setItem(versionStorageKey, next);
    } catch {
      // Explicit URL filters still work when browser storage is unavailable.
    }
    setVersion(next);
  }, [requestedVersion, versionStorageKey]);
  const selectVersion = (value: string) => {
    const next = versionFilter(value);
    setVersion(next);
    try {
      localStorage.setItem(versionStorageKey, next);
    } catch {
      // Keep the current selection even if persistence is blocked.
    }
    // Keep browser Back navigation aligned with the most recently selected filter.
    const params = new URLSearchParams(searchParams.toString());
    params.set("version", next);
    router.replace(
      `/${kind === "short" ? "short-videos" : "long-videos"}?${params}`,
      { scroll: false },
    );
  };
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
          ? t("No existing projects were found to sync.")
          : `${t("Updated:")} ${result.updated} · ${t("Unchanged:")} ${result.unchanged}${result.skipped ? ` · ${t("Skipped:")} ${result.skipped}. ${t("Check that their Bible versions are registered and their data is complete. Projects being generated are skipped until they finish.")}` : ""}`,
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
                : "365 DAYS · LANDSCAPE",
            )}
          </p>
          <h1>{t(kind === "short" ? "Short Videos" : "Long Videos")}</h1>
          <p className="muted">
            {t(
              kind === "short"
                ? "Inspiring passages, one video at a time."
                : "A journey through the entire Bible, in 365 episodes.",
            )}
          </p>
        </div>
        <div className="project-top-actions">
          <button
            type="button"
            className="primary"
            onClick={() => setCreateOpen(true)}
          >
            {t("New video project")}
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
          <span>{t(kind === "short" ? "passages" : "episodes")}</span>
        </div>
        <div>
          <span className="dot green" />
          <strong>{rows.filter((r) => !r.published).length}</strong>
          <span>{t("Unpublished")}</span>
        </div>
        <div>
          <Check size={17} />
          <strong>{rows.filter((r) => r.published).length}</strong>
          <span>{t("Published")}</span>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {syncingExisting && (
        <p className="notice" role="status">
          {t("Syncing existing projects…")}
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
              aria-label={t("Find a passage")}
              placeholder={t("Find a passage or episode…")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label={t("Bible version")}
            value={version ?? "all"}
            disabled={version === null}
            onChange={(e) => selectVersion(e.target.value)}
          >
            <option value="all">{t("All versions")}</option>
            {orderVersions(versions)
              .filter((v) => v.id !== null)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.locale.toUpperCase()} · {v.label}
                </option>
              ))}
          </select>
          <select
            aria-label={t("Filter publication")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("All projects")}</option>
            <option value="published">{t("Published")}</option>
            <option value="unpublished">{t("Unpublished")}</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("Video project")}</th>
                <th>{t("Bible version")}</th>
                <th>{t("Publication")}</th>
                <th>{t("Updated")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                .map((row) => (
                  <tr
                    key={row.id}
                    className={`video-project-row${isCurrentProject(row) ? " current-project" : ""}`}
                    tabIndex={0}
                    aria-label={`${t("Open project")}: ${row.title}`}
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
                      <div className="project-publication-controls">
                        <button
                          type="button"
                          className={
                            row.published
                              ? "project-published-button"
                              : undefined
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
                          {publicationLabel(row.published, language)}
                        </button>
                        <button
                          type="button"
                          className={`icon-button current-project-marker${isCurrentProject(row) ? " active" : ""}`}
                          aria-pressed={isCurrentProject(row)}
                          aria-label={`${t(isCurrentProject(row) ? "Remove current project mark" : "Mark as current project")}: ${row.title}`}
                          disabled={
                            kind === "long" &&
                            !isCurrentProject(row) &&
                            (currentProjects[projectVersionKey(row)]?.length ??
                              0) >= 2
                          }
                          data-tooltip={t(
                            kind === "long" &&
                              !isCurrentProject(row) &&
                              (currentProjects[projectVersionKey(row)]
                                ?.length ?? 0) >= 2
                              ? "Two projects are already marked for this Bible version. Remove one mark to choose another."
                              : isCurrentProject(row)
                                ? "Remove current project mark"
                                : "Mark as current project",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleCurrentProject(row);
                          }}
                        >
                          <Bookmark size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                    <td className="muted">
                      <UpdatedAt value={row.updated_at} />
                    </td>
                    <td>
                      <Link
                        className="button icon-button"
                        aria-label={`${t("Open project")}: ${row.title}`}
                        href={projectHref(row)}
                      >
                        <ArrowRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {loading && <div className="empty">{t("Loading projects…")}</div>}
          {!loading && !filtered.length && (
            <div className="empty">
              {rows.length === 0 && version === "all" && !query
                ? t("Create your first video project to get started.")
                : t("No videos match these filters.")}
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filtered.length} {t("projects · page")} {currentPage + 1} {t("of")}{" "}
            {pages}
          </span>
          <div>
            <label className="pagination-page-size">
              {t("Items per page")}
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
              aria-label={t("First page")}
              data-tooltip={t("First page")}
              disabled={currentPage === 0}
              onClick={() => setPage(0)}
            >
              <ChevronsLeft size={17} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              aria-label={t("Previous page")}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label={t("Next page")}
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Last page")}
              data-tooltip={t("Last page")}
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
          selectedVersion={version ?? "all"}
          close={() => setSyncOpen(false)}
          onSynced={(id) => {
            setQuery("");
            setFilter("all");
            setPage(0);
            if (version === String(id)) void load();
            else selectVersion(String(id));
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
