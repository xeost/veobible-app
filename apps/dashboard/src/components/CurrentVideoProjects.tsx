"use client";
import { UpdatedAt } from "./UpdatedAt";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Clapperboard,
  Film,
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
  projectVersionKey,
} from "../lib/current-video-projects";
import { api } from "./api";
import type { VideoRow } from "./video-project";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";

export function CurrentVideoProjects() {
  const { t, language } = useI18n();
  const { orderVersions } = usePinnedBibleVersions();
  const router = useRouter();
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
    let revision = 0;
    const load = async () => {
      const requestRevision = ++revision;
      setLoading(true);
      setError("");
      try {
        const groups = await Promise.all(
          (["short", "long"] as const).map(async (kind) => {
            let marks: Record<string, number> = {};
            try {
              marks = parseCurrentProjects(
                localStorage.getItem(currentProjectStorageKey(kind)),
              );
            } catch {
              // Browser marks are unavailable when local storage is blocked.
            }
            const ids = [...new Set(Object.values(marks))];
            const projects: VideoRow[] = [];
            for (let index = 0; index < ids.length; index += 80) {
              const data = await api<{ videos: VideoRow[] }>(
                `videos?kind=${kind}&ids=${ids.slice(index, index + 80).join(",")}`,
              );
              projects.push(
                ...data.videos.filter(
                  (row) => marks[projectVersionKey(row)] === row.id,
                ),
              );
            }
            return projects;
          }),
        );
        if (requestRevision === revision)
          setRows(groups.flat().sort((a, b) => a.id - b.id));
      } catch (error) {
        if (requestRevision === revision) setError(userMessage(error));
      } finally {
        if (requestRevision === revision) setLoading(false);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        (["short", "long"] as const).some(
          (kind) => event.key === currentProjectStorageKey(kind),
        )
      )
        void load();
    };
    void load();
    window.addEventListener("storage", onStorage);
    return () => {
      revision++;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const projectIds = rows
    .map((row) => row.id)
    .sort((a, b) => a - b)
    .join(",");
  useEffect(() => {
    let live = true;
    const ids = projectIds ? projectIds.split(",").map(Number) : [];
    setRenderedVideos({});
    if (!ids.length) {
      setCheckingVideos(false);
      return;
    }
    setCheckingVideos(true);
    const check = async () => {
      try {
        const statuses: Record<number, boolean> = {};
        for (let index = 0; index < ids.length; index += 80) {
          const data = await api<{
            projects: { id: number; rendered: boolean }[];
          }>("videos/final-videos", {
            method: "POST",
            body: JSON.stringify({ ids: ids.slice(index, index + 80) }),
          });
          for (const project of data.projects)
            statuses[project.id] = project.rendered;
        }
        if (live) setRenderedVideos(statuses);
      } catch {
        // An unavailable generation service must not look like a missing final video.
      } finally {
        if (live) setCheckingVideos(false);
      }
    };
    void check();
    return () => {
      live = false;
    };
  }, [projectIds]);

  const orderedRows = (["short", "long"] as const).flatMap((kind) =>
    orderVersions(
      rows
        .filter((row) => row.kind === kind)
        .map((row) => ({ ...row, code: row.version_code })),
    ),
  );
  const href = (row: VideoRow) =>
    `/${row.kind === "short" ? "short-videos" : "long-videos"}/${row.id}`;
  const removeMark = (row: VideoRow) => {
    try {
      const key = currentProjectStorageKey(
        row.kind === "short" ? "short" : "long",
      );
      const marks = parseCurrentProjects(localStorage.getItem(key));
      const version = projectVersionKey(row);
      if (marks[version] === row.id) {
        delete marks[version];
        localStorage.setItem(key, JSON.stringify(marks));
      }
      setRows((current) => current.filter((project) => project.id !== row.id));
      setError("");
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
    } catch (error) {
      setError(userMessage(error));
    } finally {
      setUpdatingPublication(null);
    }
  };
  const markNext = async (row: VideoRow) => {
    setAdvancing(row.id);
    setError("");
    try {
      const { project: next } = await api<{ project: VideoRow | null }>(
        `videos/${row.id}/next`,
      );
      if (!next) {
        setLastProjects((current) => new Set([...current, row.id]));
        return;
      }
      const key = currentProjectStorageKey(
        row.kind === "short" ? "short" : "long",
      );
      const marks = parseCurrentProjects(localStorage.getItem(key));
      const version = projectVersionKey(row);
      // Do not replace a newer mark made in another tab while the request was running.
      if (marks[version] !== row.id) return;
      marks[version] = next.id;
      localStorage.setItem(key, JSON.stringify(marks));
      setRows((current) =>
        current.map((project) => (project.id === row.id ? next : project)),
      );
    } catch (error) {
      setError(userMessage(error));
    } finally {
      setAdvancing(null);
    }
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>{t("Current projects")}</h3>
        <span className="muted">{t("Marked in this browser")}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t("Project")}</th>
              <th>{t("Format")}</th>
              <th>{t("Bible version")}</th>
              <th>{t("Publication")}</th>
              <th>{t("Actions")}</th>
              <th>{t("Updated")}</th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row) => (
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
                  <span className="button">
                    {row.kind === "short" ? (
                      <Clapperboard size={16} aria-hidden="true" />
                    ) : (
                      <Film size={16} aria-hidden="true" />
                    )}
                    {t(row.kind === "short" ? "Short" : "Long")}
                  </span>
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
                    <span
                      className={`project-final-video-indicator${renderedVideos[row.id] ? " available" : ""}`}
                      tabIndex={0}
                      role="img"
                      aria-label={t(
                        checkingVideos
                          ? "Checking final video availability…"
                          : renderedVideos[row.id] === undefined
                            ? "Final video availability could not be checked."
                            : renderedVideos[row.id]
                              ? "Final video rendered"
                              : "No final video rendered",
                      )}
                      data-tooltip={t(
                        checkingVideos
                          ? "Checking final video availability…"
                          : renderedVideos[row.id] === undefined
                            ? "Final video availability could not be checked."
                            : renderedVideos[row.id]
                              ? "Final video rendered"
                              : "No final video rendered",
                      )}
                    >
                      {checkingVideos ? (
                        <LoaderCircle
                          size={17}
                          className="voice-spinner"
                          aria-hidden="true"
                        />
                      ) : renderedVideos[row.id] === undefined ? (
                        <CircleHelp size={17} aria-hidden="true" />
                      ) : renderedVideos[row.id] ? (
                        <FileVideo size={17} aria-hidden="true" />
                      ) : (
                        <VideoOff size={17} aria-hidden="true" />
                      )}
                    </span>
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
                  </div>
                </td>
                <td className="muted">
                  <UpdatedAt value={row.updated_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p className="error">{t(error)}</p>}
        {loading && <div className="empty">{t("Loading projects…")}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="empty">
            {t("Mark a project in Short Videos or Long Videos to see it here.")}
          </div>
        )}
      </div>
    </section>
  );
}
