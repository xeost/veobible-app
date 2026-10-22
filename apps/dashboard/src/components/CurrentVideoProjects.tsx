"use client";
import { UpdatedAt } from "./UpdatedAt";
import { PublishedProjectCleanup } from "./PublishedProjectCleanup";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  FolderOpen,
  ArrowRightToLine,
  LoaderCircle,
  FileVideo,
  VideoOff,
  CircleHelp,
} from "lucide-react";
import { useI18n } from "../i18n/context";
import { userMessage, publicationLabel } from "../lib/presentation";
import {
  currentProjectStorageKey,
  parseCurrentProjects,
  type CurrentProjects,
  removeCurrentProject,
  advanceCurrentProjectMark,
  projectVersionKey,
} from "../lib/current-video-projects";
import { api } from "./api";
import type { VideoRow } from "./video-project";
import { useHomeUpdates } from "./useHomeUpdates";
import { useGenerationQueue } from "./GenerationQueueContext";
import { projectChangedEvent, projectRenderStatus } from "../lib/home-updates";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";

function FinalVideoIndicator({
  row,
  rendered,
  checking,
}: {
  row: VideoRow;
  rendered?: boolean;
  checking: boolean;
}) {
  const { t } = useI18n();
  const queue = useGenerationQueue();
  const renderStatus = projectRenderStatus(queue, row.id, row.kind);
  const loading = checking && rendered === undefined;
  const label =
    renderStatus === "running"
      ? "Creating the video"
      : renderStatus === "queued"
        ? "Waiting to generate the video"
        : loading
          ? "Checking final video availability…"
          : rendered === undefined
            ? "Final video availability could not be checked."
            : rendered
              ? "Final video rendered"
              : "No final video rendered";
  return (
    <span
      className={`project-final-video-indicator${rendered && !renderStatus ? " available" : ""}`}
      tabIndex={0}
      role="img"
      aria-label={t(label)}
      data-tooltip={t(label)}
    >
      {renderStatus || loading ? (
        <LoaderCircle
          size={17}
          className="project-final-video-spinner"
          aria-hidden="true"
        />
      ) : rendered === undefined ? (
        <CircleHelp size={17} aria-hidden="true" />
      ) : rendered ? (
        <FileVideo size={17} aria-hidden="true" />
      ) : (
        <VideoOff size={17} aria-hidden="true" />
      )}
    </span>
  );
}

export function CurrentVideoProjects({
  onLoadingChange,
}: {
  onLoadingChange?: (loading: boolean) => void;
}) {
  const { t, language } = useI18n();
  const { orderVersions } = usePinnedBibleVersions();
  const router = useRouter();
  const revision = useRef(0);
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [renderedVideos, setRenderedVideos] = useState<Record<number, boolean>>(
    {},
  );
  const [checkingVideos, setCheckingVideos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [updatingPublication, setUpdatingPublication] = useState<number | null>(
    null,
  );
  const [lastProjects, setLastProjects] = useState<Set<number>>(new Set());

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useHomeUpdates(async (signal) => {
    const requestRevision = ++revision.current;
    const current = () =>
      !signal.aborted && requestRevision === revision.current;
    try {
      const groups = await Promise.all(
        (["short", "long", "book"] as const).map(async (kind) => {
          let marks: CurrentProjects = {};
          try {
            marks = parseCurrentProjects(
              localStorage.getItem(currentProjectStorageKey(kind)),
              kind,
            );
          } catch {
            // Browser marks are unavailable when local storage is blocked.
          }
          const ids = [...new Set(Object.values(marks).flat())];
          const projects: VideoRow[] = [];
          for (let index = 0; index < ids.length; index += 80) {
            const data = await api<{ videos: VideoRow[] }>(
              `videos?kind=${kind}&ids=${ids.slice(index, index + 80).join(",")}`,
              { signal },
            );
            projects.push(
              ...data.videos.filter((row) =>
                marks[projectVersionKey(row)]?.includes(row.id),
              ),
            );
          }
          return projects;
        }),
      );
      if (!current()) return;
      const projects = groups.flat().sort((a, b) => a.id - b.id);
      setRows(projects);
      setLoading(false);
      setError("");
      const ids = projects.map((row) => row.id);
      setCheckingVideos(Boolean(ids.length));
      try {
        const statuses: Record<number, boolean> = {};
        for (let index = 0; index < ids.length; index += 80) {
          const data = await api<{
            projects: { id: number; rendered: boolean }[];
          }>("videos/final-videos", {
            method: "POST",
            signal,
            body: JSON.stringify({ ids: ids.slice(index, index + 80) }),
          });
          for (const project of data.projects)
            statuses[project.id] = project.rendered;
        }
        if (current()) setRenderedVideos(statuses);
      } catch {
        // Retain known availability during a temporary connection failure.
      } finally {
        if (current()) setCheckingVideos(false);
      }
    } catch (cause) {
      if (current()) setError(userMessage(cause));
    } finally {
      if (current()) setLoading(false);
    }
  });

  const orderedRows = (["short", "long", "book"] as const).flatMap((kind) =>
    orderVersions(
      rows
        .filter((row) => row.kind === kind)
        .map((row) => ({ ...row, code: row.version_code })),
    ),
  );
  const href = (row: VideoRow) =>
    `/${row.kind === "short" ? "short-videos" : row.kind === "book" ? "book-videos" : "long-videos"}/${row.id}`;
  const removeMark = (row: VideoRow) => {
    try {
      const key = currentProjectStorageKey(
        row.kind === "short" ? "short" : row.kind === "book" ? "book" : "long",
      );
      const marks = parseCurrentProjects(
        localStorage.getItem(key),
        row.kind === "short" ? "short" : row.kind === "book" ? "book" : "long",
      );
      localStorage.setItem(
        key,
        JSON.stringify(removeCurrentProject(marks, row)),
      );
      revision.current++;
      setRows((current) => current.filter((project) => project.id !== row.id));
      setLastProjects(new Set());
      setError("");
      window.dispatchEvent(new Event(projectChangedEvent));
    } catch (error) {
      setError(userMessage(error));
    }
  };
  const togglePublication = async (row: VideoRow) => {
    setUpdatingPublication(row.id);
    setError("");
    try {
      const published = !row.published;
      await api(`videos/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ published }),
      });
      revision.current++;
      setRows((current) =>
        current.map((project) =>
          project.id === row.id
            ? {
                ...project,
                published: Number(published),
                updated_at: new Date().toISOString(),
              }
            : project,
        ),
      );
      window.dispatchEvent(new Event(projectChangedEvent));
    } catch (error) {
      setError(userMessage(error));
    } finally {
      setUpdatingPublication(null);
    }
  };
  const openFolder = async (row: VideoRow) => {
    setError("");
    try {
      await api(`videos/${row.id}/open-folder`, { method: "POST" });
    } catch {
      setError(
        "Could not open the project folder. Check that generation is available and try again.",
      );
    }
  };
  const markNext = async (row: VideoRow) => {
    setAdvancing(row.id);
    setError("");
    try {
      const kind =
        row.kind === "short" ? "short" : row.kind === "book" ? "book" : "long";
      const key = currentProjectStorageKey(kind);
      const before = parseCurrentProjects(localStorage.getItem(key), kind);
      const others = (before[projectVersionKey(row)] ?? []).filter(
        (id) => id !== row.id,
      );
      const { project: next } = await api<{ project: VideoRow | null }>(
        `videos/${row.id}/next${others.length ? `?exclude=${others.join(",")}` : ""}`,
      );
      if (!next) {
        setLastProjects((current) => new Set([...current, row.id]));
        return;
      }
      const marks = parseCurrentProjects(localStorage.getItem(key), kind);
      // Replace only this row's marker, preserving the independent second marker.
      const advancedMarks = advanceCurrentProjectMark(marks, row, next);
      if (advancedMarks === marks) return;
      localStorage.setItem(key, JSON.stringify(advancedMarks));
      setLastProjects(new Set());
      revision.current++;
      setRows((current) =>
        current.map((project) => (project.id === row.id ? next : project)),
      );
      window.dispatchEvent(new Event(projectChangedEvent));
    } catch (error) {
      setError(userMessage(error));
    } finally {
      setAdvancing(null);
    }
  };
  return (
    <>
      {error && <p className="error">{t(error)}</p>}
      {(["short", "long", "book"] as const).map((kind) => (
        <section className="panel" key={kind}>
          <div className="panel-heading">
            <h3>
              {t(
                kind === "short"
                  ? "Current projects · Short videos"
                  : kind === "book"
                    ? "Current projects · Book videos"
                    : "Current projects · Long videos",
              )}
            </h3>
            <PublishedProjectCleanup
              kind={kind}
              onDeleted={() =>
                window.dispatchEvent(new Event(projectChangedEvent))
              }
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t("Project")}</th>
                  <th>{t("Bible version")}</th>
                  <th>{t("Publication")}</th>
                  <th>{t("Actions")}</th>
                  <th>{t("Updated")}</th>
                </tr>
              </thead>
              <tbody>
                {orderedRows
                  .filter((row) => row.kind === kind)
                  .map((row) => (
                    <tr
                      key={row.id}
                      className="video-project-row current-project"
                      tabIndex={0}
                      aria-label={`${t("Open project")}: ${row.title}`}
                      onClick={(event) => {
                        if (!(event.target as Element).closest("a, button"))
                          router.push(href(row));
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          router.push(href(row));
                        }
                      }}
                    >
                      <td className="muted">{row.id}</td>
                      <td>
                        <Link className="button project-name" href={href(row)}>
                          <Bookmark size={17} aria-hidden="true" />
                          {row.title}
                        </Link>
                      </td>
                      <td>
                        {row.version_code.toUpperCase()}
                        <small className="muted">
                          {" "}
                          {row.locale.toUpperCase()} · {row.label}
                        </small>
                      </td>
                      <td>
                        <div className="project-publication-controls">
                          <FinalVideoIndicator
                            row={row}
                            rendered={renderedVideos[row.id]}
                            checking={checkingVideos}
                          />
                          <button
                            type="button"
                            className={`badge${row.published ? " publication-published" : ""}`}
                            aria-pressed={Boolean(row.published)}
                            aria-label={`${t(row.published ? "Mark as unpublished" : "Mark as published")}: ${row.title}`}
                            data-tooltip={t(
                              row.published
                                ? "Mark as unpublished"
                                : "Mark as published",
                            )}
                            disabled={
                              loading ||
                              advancing !== null ||
                              updatingPublication !== null
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              void togglePublication(row);
                            }}
                          >
                            {updatingPublication === row.id && (
                              <LoaderCircle
                                size={12}
                                className="voice-spinner"
                                aria-hidden="true"
                              />
                            )}
                            {publicationLabel(row.published, language)}
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="project-publication-controls">
                          <button
                            type="button"
                            className="icon-button current-project-marker active"
                            aria-label={`${t("Remove current project mark")}: ${row.title}`}
                            data-tooltip={t("Remove current project mark")}
                            disabled={
                              loading ||
                              advancing !== null ||
                              updatingPublication !== null
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              removeMark(row);
                            }}
                          >
                            <Bookmark size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button current-project-marker"
                            aria-label={`${t("Mark the next project")}: ${row.title}`}
                            data-tooltip={t(
                              lastProjects.has(row.id)
                                ? "There is no next project for this format and Bible version."
                                : "Mark the next project in this format and Bible version, ordered by ID.",
                            )}
                            disabled={
                              loading ||
                              advancing !== null ||
                              updatingPublication !== null ||
                              lastProjects.has(row.id)
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              void markNext(row);
                            }}
                          >
                            {advancing === row.id ? (
                              <LoaderCircle
                                size={16}
                                className="voice-spinner"
                                aria-hidden="true"
                              />
                            ) : (
                              <ArrowRightToLine size={16} aria-hidden="true" />
                            )}
                          </button>
                          {renderedVideos[row.id] && (
                            <button
                              type="button"
                              className="icon-button current-project-marker"
                              aria-label={`${t("Open project folder in Finder")}: ${row.title}`}
                              data-tooltip={t(
                                "Open the project folder in Finder on the Mac that generates videos",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                void openFolder(row);
                              }}
                            >
                              <FolderOpen size={16} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="muted">
                        <UpdatedAt value={row.updated_at} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {loading && <div className="empty">{t("Loading projects…")}</div>}
            {!loading && !error && !rows.some((row) => row.kind === kind) && (
              <div className="empty">
                {t(
                  kind === "short"
                    ? "Mark a project in Short Videos to see it here."
                    : kind === "book"
                      ? "Mark a project in Book Videos to see it here."
                      : "Mark a project in Long Videos to see it here.",
                )}
              </div>
            )}
          </div>
        </section>
      ))}
    </>
  );
}
