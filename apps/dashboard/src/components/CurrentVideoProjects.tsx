"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Clapperboard, Film } from "lucide-react";
import { useI18n } from "../i18n/context";
import { userMessage, publicationLabel } from "../lib/presentation";
import {
  currentProjectStorageKey,
  parseCurrentProjects,
  projectVersionKey,
} from "../lib/current-video-projects";
import { api, date } from "./api";
import type { VideoRow } from "./video-project";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";

export function CurrentVideoProjects() {
  const { t, language } = useI18n();
  const { orderVersions } = usePinnedBibleVersions();
  const router = useRouter();
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const orderedRows = (["short", "long"] as const).flatMap((kind) =>
    orderVersions(
      rows
        .filter((row) => row.kind === kind)
        .map((row) => ({ ...row, code: row.version_code })),
    ),
  );
  const href = (row: VideoRow) =>
    `/${row.kind === "short" ? "short-videos" : "long-videos"}/${row.id}`;
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
                  if (!(event.target as Element).closest("a"))
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
                  <span
                    className={`badge${row.published ? " publication-published" : ""}`}
                  >
                    {publicationLabel(row.published, language)}
                  </span>
                </td>
                <td className="muted">{date(row.updated_at, language)}</td>
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
