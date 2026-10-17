"use client";
import { useToast } from "./ToastProvider";
import { useDebouncedValue } from "./useDebouncedValue";
import type { PageInfo } from "../lib/pagination";
import { UpdatedAt } from "./UpdatedAt";
import { SyncVideoProjectsModal } from "./SyncVideoProjectsModal";
import { VideoProjectMenu } from "./VideoProjectMenu";
import { CreateVideoProjectModal } from "./CreateVideoProjectModal";
import { useI18n } from "../i18n/context";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";
import type { BibleVersionOption as BibleVersion } from "../lib/bible-versions";
import { userMessage, publicationLabel } from "../lib/presentation";
import { useEffect, useState, useCallback, useRef } from "react";
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
  LoaderCircle,
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
  const notify = useToast();
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
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [rows, setRows] = useState<VideoRow[]>([]),
    [versions, setVersions] = useState<BibleVersion[]>([]),
    [version, setVersion] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("unpublished"),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [pagination, setPagination] = useState<PageInfo>({
    page: 1,
    pageSize: 10,
    total: 0,
    pages: 1,
  });
  const [summary, setSummary] = useState({
    total: 0,
    published: 0,
    unpublished: 0,
  });
  const selectionScope = JSON.stringify([
    kind,
    version,
    query,
    filter,
    page,
    pageSize,
  ]);
  const [selection, setSelection] = useState<{
    scope: string;
    ids: Set<number>;
  }>({ scope: "", ids: new Set() });
  const [updatingSelection, setUpdatingSelection] = useState(false);
  const updatingSelectionRef = useRef(false);
  const selectedRows =
    selection.scope === selectionScope
      ? rows.filter((row) => selection.ids.has(row.id))
      : [];
  const selectedIds = new Set(selectedRows.map((row) => row.id));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  useEffect(() => {
    setSelection({ scope: selectionScope, ids: new Set() });
  }, [selectionScope]);
  const selectProject = (id: number, checked: boolean) => {
    const ids = new Set(selectedIds);
    if (checked) ids.add(id);
    else ids.delete(id);
    setSelection({ scope: selectionScope, ids });
  };
  const debouncedQuery = useDebouncedValue(query);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    if (version === null || query !== debouncedQuery) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        kind,
        version,
        page: String(page),
        pageSize: String(pageSize),
        query: debouncedQuery,
        publication: filter,
      });
      const data = await api<{
        videos: VideoRow[];
        pagination: PageInfo;
        summary: typeof summary;
      }>(`videos?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setRows(data.videos);
      setPagination(data.pagination);
      setSummary(data.summary);
      setError("");
      if (data.pagination.page !== page) setPage(data.pagination.page);
    } catch (cause) {
      if (!controller.signal.aborted) setError(userMessage(cause));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [kind, version, page, pageSize, debouncedQuery, query, filter]);
  useEffect(() => {
    const controller = new AbortController();
    const migrate = async () => {
      const legacyKey = `veo-current-video-project:${kind}`;
      try {
        const id = Number(localStorage.getItem(legacyKey));
        if (!Number.isSafeInteger(id) || id <= 0) return;
        const data = await api<{ videos: VideoRow[] }>(
          `videos?kind=${kind}&ids=${id}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted || !data.videos[0]) return;
        const row = data.videos[0];
        const marks = parseCurrentProjects(
          localStorage.getItem(currentProjectStorageKey),
          kind,
        );
        const key = projectVersionKey(row);
        if (marks[key] === undefined) {
          const next = { ...marks, [key]: [row.id] };
          localStorage.setItem(currentProjectStorageKey, JSON.stringify(next));
          setCurrentProjects(next);
        }
        localStorage.removeItem(legacyKey);
      } catch {
        // Mark migration is optional when storage or the connection is unavailable.
      }
    };
    void migrate();
    return () => controller.abort();
  }, [kind, currentProjectStorageKey]);
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
    setPage(1);
  }, [requestedVersion, versionStorageKey]);
  const selectVersion = (value: string) => {
    const next = versionFilter(value);
    setVersion(next);
    setPage(1);
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
    void api("versions/options")
      .then((d) => setVersions(d.versions))
      .catch((e) => setError(userMessage(e)));
  }, []);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  const Icon = kind === "short" ? Clapperboard : Film;
  const syncExisting = async () => {
    if (syncingExisting) return;
    setSyncingExisting(true);
    setError("");
    try {
      const result = await api<{
        updated: number;
        unchanged: number;
        skipped: number;
        total: number;
      }>(`videos/sync-existing?kind=${kind}`, { method: "POST" });
      notify(
        result.total === 0
          ? t("No existing projects were found to sync.")
          : `${t("Updated:")} ${result.updated} · ${t("Unchanged:")} ${result.unchanged}${result.skipped ? ` · ${t("Skipped:")} ${result.skipped}. ${t("Check that their Bible versions are registered and their data is complete. Projects being generated are skipped until they finish.")}` : ""}`,
      );
      await load();
    } catch (cause) {
      notify(userMessage(cause), "error");
    } finally {
      setSyncingExisting(false);
    }
  };
  const updateSelectedPublication = async (published: boolean) => {
    if (loading || updatingSelectionRef.current || !selectedRows.length) return;
    updatingSelectionRef.current = true;
    setUpdatingSelection(true);
    setError("");
    try {
      const result = await api<{ updated: number }>("videos/publication", {
        method: "PATCH",
        body: JSON.stringify({
          kind,
          ids: selectedRows.map((row) => row.id),
          published,
        }),
      });
      notify(
        t("Publication updated for {count} projects.").replace(
          "{count}",
          String(result.updated),
        ),
      );
      setSelection({ scope: selectionScope, ids: new Set() });
      await load();
    } catch (cause) {
      notify(userMessage(cause), "error");
    } finally {
      updatingSelectionRef.current = false;
      setUpdatingSelection(false);
    }
  };
  const projectHref = (row: VideoRow) =>
    `/${kind === "short" ? "short-videos" : "long-videos"}/${String(row.id)}`;
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
          <strong>{summary.total}</strong>
          <span>{t(kind === "short" ? "passages" : "episodes")}</span>
        </div>
        <div>
          <span className="dot green" />
          <strong>{summary.unpublished}</strong>
          <span>{t("Unpublished")}</span>
        </div>
        <div>
          <Check size={17} />
          <strong>{summary.published}</strong>
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
      <section className="panel catalog-panel">
        <div className="catalog-toolbar">
          <div className="search">
            <Search size={17} />
            <input
              aria-label={t("Find a passage")}
              placeholder={t("Find a passage or episode…")}
              value={query}
              disabled={updatingSelection}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label={t("Bible version")}
            value={version ?? "all"}
            disabled={version === null || updatingSelection}
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
            disabled={updatingSelection}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t("All projects")}</option>
            <option value="published">{t("Published")}</option>
            <option value="unpublished">{t("Unpublished")}</option>
          </select>
        </div>
        {selectedRows.length > 0 && (
          <div
            className="project-bulk-actions"
            role="group"
            aria-label={t("Selected project actions")}
          >
            <span role="status">
              {t("{count} projects selected").replace(
                "{count}",
                String(selectedRows.length),
              )}
            </span>
            <button
              type="button"
              disabled={loading || updatingSelection}
              onClick={() => void updateSelectedPublication(true)}
            >
              {t("Mark as published")}
            </button>
            <button
              type="button"
              disabled={loading || updatingSelection}
              onClick={() => void updateSelectedPublication(false)}
            >
              {t("Mark as unpublished")}
            </button>
            <button
              type="button"
              disabled={updatingSelection}
              onClick={() =>
                setSelection({ scope: selectionScope, ids: new Set() })
              }
            >
              {t("Clear selection")}
            </button>
            {updatingSelection && (
              <span role="status">
                <LoaderCircle
                  size={15}
                  className="voice-spinner"
                  aria-hidden="true"
                />
                {t("Updating publication…")}
              </span>
            )}
          </div>
        )}
        <div className="table-wrap">
          <table className="catalog">
            <thead>
              <tr>
                <th className="project-selection-cell" scope="col">
                  <input
                    type="checkbox"
                    aria-label={t("Select all projects on this page")}
                    checked={allSelected}
                    ref={(input) => {
                      if (input)
                        input.indeterminate =
                          selectedRows.length > 0 && !allSelected;
                    }}
                    disabled={loading || updatingSelection || !rows.length}
                    onChange={(event) =>
                      setSelection({
                        scope: selectionScope,
                        ids: new Set(
                          event.target.checked ? rows.map((row) => row.id) : [],
                        ),
                      })
                    }
                  />
                </th>
                <th>ID</th>
                <th>{t("Video project")}</th>
                <th>{t("Bible version")}</th>
                <th>{t("Publication")}</th>
                <th>{t("Updated")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`video-project-row${isCurrentProject(row) ? " current-project" : ""}`}
                  tabIndex={0}
                  aria-label={`${t("Open project")}: ${row.title}`}
                  onClick={(event) => {
                    if (
                      (event.target as Element).closest(
                        "a, button, input, label",
                      )
                    )
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
                  <td
                    className="project-selection-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      aria-label={t("Select project: {title}").replace(
                        "{title}",
                        row.title,
                      )}
                      checked={selectedIds.has(row.id)}
                      disabled={loading || updatingSelection}
                      onChange={(event) =>
                        selectProject(row.id, event.target.checked)
                      }
                    />
                  </td>
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
                          row.published ? "project-published-button" : undefined
                        }
                        disabled={updatingSelection || loading}
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
                            notify(userMessage(cause), "error");
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
                            (currentProjects[projectVersionKey(row)]?.length ??
                              0) >= 2
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
          {!loading && !rows.length && (
            <div className="empty">
              {summary.total === 0 && version === "all" && !query
                ? t("Create your first video project to get started.")
                : t("No videos match these filters.")}
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {pagination.total} {t("projects · page")} {pagination.page}{" "}
            {t("of")} {pagination.pages}
          </span>
          <div>
            <label className="pagination-page-size">
              {t("Items per page")}
              <select
                value={pageSize}
                disabled={updatingSelection}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
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
              disabled={loading || updatingSelection || pagination.page === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft size={17} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              aria-label={t("Previous page")}
              disabled={loading || updatingSelection || pagination.page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label={t("Next page")}
              disabled={
                loading ||
                updatingSelection ||
                pagination.page >= pagination.pages
              }
              onClick={() =>
                setPage((current) => Math.min(pagination.pages, current + 1))
              }
            >
              <ChevronRight size={17} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Last page")}
              data-tooltip={t("Last page")}
              disabled={
                loading ||
                updatingSelection ||
                pagination.page >= pagination.pages
              }
              onClick={() => setPage(pagination.pages)}
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
            setPage(1);
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
