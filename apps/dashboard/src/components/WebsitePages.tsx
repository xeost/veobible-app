"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Clapperboard,
  Film,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  ExternalLink,
} from "lucide-react";
import type { VideoProjectPage } from "../lib/pages-from-video-projects";
import type { PageInfo } from "../lib/pagination";
import type { BibleVersionOption } from "../lib/bible-versions";
import { api } from "./api";
import { useI18n } from "../i18n/context";
import { useDebouncedValue } from "./useDebouncedValue";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";
import { useToast } from "./ToastProvider";
import { userMessage } from "../lib/presentation";
import { UpdatedAt } from "./UpdatedAt";
import { ProjectYouTubeLink } from "./ProjectYouTubeLink";
import { WebsitePageModal } from "./WebsitePageModal";
type Data = {
  pages: VideoProjectPage[];
  pagination: PageInfo;
  summary: { total: number; included: number; excluded: number };
  versions: BibleVersionOption[];
};
const validVersion = (value: string | null) =>
  value === "all" ||
  (value !== null &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value)))
    ? value
    : "all";
export function WebsitePages({
  kind,
  siteUrl,
}: {
  kind: "short" | "long";
  siteUrl: string | null;
}) {
  const { t } = useI18n();
  const notify = useToast();
  const { orderVersions } = usePinnedBibleVersions();
  const key = `veo-website-page-version-filter:${kind}`;
  const [version, setVersion] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<Data>({
    pages: [],
    versions: [],
    summary: { total: 0, included: 0, excluded: 0 },
    pagination: { page: 1, pageSize: 10, total: 0, pages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<VideoProjectPage | null>(null);
  const request = useRef<AbortController | null>(null);
  const debouncedQuery = useDebouncedValue(query);
  useEffect(() => {
    let initial = "all";
    try {
      initial = validVersion(localStorage.getItem(key));
    } catch {}
    setVersion(initial);
    setPage(1);
  }, [key]);
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
        query: debouncedQuery,
        filter,
        page: String(page),
        pageSize: String(pageSize),
      });
      const result = await api<Data>(`website/pages?${params}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setData(result);
      setError("");
      if (result.pagination.page !== page) setPage(result.pagination.page);
    } catch (cause) {
      if (!controller.signal.aborted) setError(userMessage(cause));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [kind, version, query, debouncedQuery, filter, page, pageSize]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  const selectVersion = (value: string) => {
    setVersion(value);
    setPage(1);
    try {
      localStorage.setItem(key, value);
    } catch {}
  };
  const toggleInclusion = async (row: VideoProjectPage) => {
    setUpdating(true);
    try {
      await api("website/pages", {
        method: "POST",
        body: JSON.stringify({
          videoProjectId: row.id,
          included: !row.included,
        }),
      });
      await load();
    } catch (cause) {
      notify(userMessage(cause), "error");
    } finally {
      setUpdating(false);
    }
  };
  const open = (row: VideoProjectPage) => {
    if (!loading && !updating) setEditing(row);
  };
  const Icon = kind === "short" ? Clapperboard : Film;
  const disabled = loading || updating;
  return (
    <>
      <div className="video-summary">
        <div>
          <Icon size={21} aria-hidden="true" />
          <strong>{data.summary.total}</strong>
          <span>{t("pages")}</span>
        </div>
        <div>
          <span className="dot green" />
          <strong>{data.summary.included}</strong>
          <span>{t("Included pages")}</span>
        </div>
        <div>
          <strong>{data.summary.excluded}</strong>
          <span>{t("Excluded pages")}</span>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <section
        className="panel catalog-panel website-pages-panel"
        aria-label={t(
          kind === "short" ? "Daily dose of God" : "Bible in 365 days",
        )}
      >
        <div className="catalog-toolbar">
          <div className="search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label={t("Search pages")}
              placeholder={t("Find a page or video project…")}
              maxLength={500}
              value={query}
              disabled={updating}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label={t("Bible version")}
            value={version ?? "all"}
            disabled={version === null || updating}
            onChange={(e) => selectVersion(e.target.value)}
          >
            <option value="all">{t("All versions")}</option>
            {orderVersions(data.versions).map((v) => (
              <option value={v.id} key={v.id}>
                {v.locale.toUpperCase()} · {v.label}
              </option>
            ))}
          </select>
          <select
            aria-label={t("Filter pages")}
            value={filter}
            disabled={updating}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t("All pages")}</option>
            <option value="included">{t("Included pages")}</option>
            <option value="excluded">{t("Excluded pages")}</option>
            <option value="missing-youtube">
              {t("Missing YouTube video")}
            </option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog website-pages-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("Page")}</th>
                <th>{t("Bible version")}</th>
                <th>{t("Website description")}</th>
                <th>{t("Inclusion")}</th>
                <th>YouTube</th>
                <th>{t("Updated")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.pages.map((row) => (
                <tr
                  key={row.id}
                  className="video-project-row"
                  tabIndex={0}
                  aria-label={`${t("Edit page")}: ${row.title}`}
                  onClick={(e) => {
                    if (
                      !(e.target as Element).closest(
                        "a,button,input,label,select,textarea",
                      )
                    )
                      open(row);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      open(row);
                    }
                  }}
                >
                  <td className="muted">{row.id}</td>
                  <td>
                    <button
                      type="button"
                      className="project-name"
                      disabled={disabled}
                      onClick={() => open(row)}
                    >
                      <span className={`video-icon ${kind}`}>
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <span>
                        {row.title}
                        <small>
                          {row.locale.toUpperCase()} · {row.label}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>{row.version.toUpperCase()}</td>
                  <td>
                    <span
                      className="website-page-description"
                      title={row.description}
                    >
                      {row.description || "—"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={
                        row.included ? "project-published-button" : undefined
                      }
                      disabled={disabled}
                      aria-label={`${t(row.included ? "Exclude page" : "Include page")}: ${row.title}`}
                      onClick={() => void toggleInclusion(row)}
                    >
                      {t(row.included ? "Included" : "Excluded")}
                    </button>
                    {row.issue && (
                      <small className="website-page-issue">
                        {t(row.issue)}
                      </small>
                    )}
                  </td>
                  <td>
                    <ProjectYouTubeLink
                      socialVideoIds={JSON.stringify({
                        youtube: row.youtube_id,
                      })}
                    />
                  </td>
                  <td className="muted">
                    <UpdatedAt value={row.updated_at} />
                  </td>
                  <td>
                    <div className="website-page-row-actions">
                      {row.path && (
                        <a
                          className="button icon-button"
                          href={`${siteUrl ?? "https://veobible.com"}${row.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${t("View website page")}: ${row.title}`}
                        >
                          <ExternalLink size={16} aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        className="icon-button"
                        disabled={disabled}
                        aria-label={`${t("Edit page")}: ${row.title}`}
                        onClick={() => open(row)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="empty" role="status">
              {t("Loading pages…")}
            </div>
          )}
          {!loading && !data.pages.length && (
            <div className="empty">{t("No pages match these filters.")}</div>
          )}
        </div>
        <div className="pagination">
          <span>
            {data.pagination.total} {t("pages · page")} {data.pagination.page}{" "}
            {t("of")} {data.pagination.pages}
          </span>
          <div>
            <label className="pagination-page-size">
              {t("Items per page")}
              <select
                value={pageSize}
                disabled={updating}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={t("First page")}
              disabled={disabled || data.pagination.page === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft size={17} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Previous page")}
              disabled={disabled || data.pagination.page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Next page")}
              disabled={
                disabled || data.pagination.page >= data.pagination.pages
              }
              onClick={() =>
                setPage((p) => Math.min(data.pagination.pages, p + 1))
              }
            >
              <ChevronRight size={17} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Last page")}
              disabled={
                disabled || data.pagination.page >= data.pagination.pages
              }
              onClick={() => setPage(data.pagination.pages)}
            >
              <ChevronsRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {editing && (
        <WebsitePageModal
          page={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </>
  );
}
