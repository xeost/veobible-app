"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AudioLines, ArrowRightToLine, LoaderCircle } from "lucide-react";
import { useI18n } from "../i18n/context";
import type { AudioCatalog, AudioCatalogRow } from "../lib/audio-listing";
import {
  currentAudioStorageKey,
  parseCurrentAudioProjects,
  audioProjectVersionKey,
} from "../lib/current-audio-projects";
import { statusLabel, userMessage } from "../lib/presentation";
import { api } from "./api";
import { UpdatedAt } from "./UpdatedAt";
import { AudioProjectMarker } from "./AudioProjectMarker";
import { useCurrentAudioProjects } from "./useCurrentAudioProjects";
import { useHomeUpdates } from "./useHomeUpdates";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";

export function CurrentAudioProjects({
  onLoadingChange,
  locale = "all",
}: {
  onLoadingChange?: (loading: boolean) => void;
  locale?: "all" | "es" | "en" | "pt";
}) {
  const { t, language } = useI18n();
  const router = useRouter();
  const { marks, toggle, advance } = useCurrentAudioProjects();
  const { orderVersions } = usePinnedBibleVersions();
  const [rows, setRows] = useState<AudioCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [lastProjects, setLastProjects] = useState<Set<number>>(new Set());
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);
  useHomeUpdates(async (signal) => {
    try {
      let stored = {} as typeof marks;
      try {
        stored = parseCurrentAudioProjects(
          localStorage.getItem(currentAudioStorageKey),
        );
      } catch {
        // Browser marks are unavailable when local storage is blocked.
      }
      const ids = [...new Set(Object.values(stored).flat())];
      const projects: AudioCatalogRow[] = [];
      for (let index = 0; index < ids.length; index += 80) {
        const data = await api<AudioCatalog>(
          `audios?catalog=1&pageSize=100&ids=${ids.slice(index, index + 80).join(",")}`,
          { signal },
        );
        projects.push(
          ...data.projects.filter((row) =>
            stored[audioProjectVersionKey(row)]?.includes(row.id),
          ),
        );
      }
      if (!signal.aborted) {
        setRows(projects);
        setLastProjects(new Set());
        setError("");
      }
    } catch (cause) {
      if (!signal.aborted) setError(userMessage(cause));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  });
  const ordered = orderVersions(
    rows
      .filter((row) => locale === "all" || row.version.locale === locale)
      .map((row) => ({
        ...row,
        locale: row.version.locale,
        code: row.version.code,
      })),
  );
  const href = (row: AudioCatalogRow) => `/audios/${row.edition}/${row.book}`;
  const markNext = async (row: AudioCatalogRow) => {
    setAdvancing(row.id);
    setError("");
    try {
      const params = new URLSearchParams({
        catalog: "1",
        edition: row.edition,
        afterId: String(row.id),
        pageSize: "3",
      });
      const data = await api<AudioCatalog>(`audios?${params}`);
      const current = parseCurrentAudioProjects(
        localStorage.getItem(currentAudioStorageKey),
      );
      const next = data.projects.find(
        (project) =>
          !current[audioProjectVersionKey(project)]?.includes(project.id),
      );
      if (!next) {
        setLastProjects((previous) => new Set([...previous, row.id]));
        return;
      }
      if (advance(row, next)) {
        setRows((previous) =>
          previous.map((project) => (project.id === row.id ? next : project)),
        );
        setLastProjects(new Set());
      }
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setAdvancing(null);
    }
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>{t("Current projects · Audios")}</h3>
      </div>
      {error && <p className="error">{t(error)}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t("Audio project")}</th>
              <th>{t("Bible version")}</th>
              <th>{t("Chapters")}</th>
              <th>{t("Status")}</th>
              <th>{t("Actions")}</th>
              <th>{t("Updated")}</th>
            </tr>
          </thead>
          <tbody>
            {ordered
              .filter((row) =>
                marks[audioProjectVersionKey(row)]?.includes(row.id),
              )
              .map((row) => (
                <tr
                  key={row.id}
                  className="video-project-row current-project"
                  tabIndex={0}
                  aria-label={`${t("Open project")}: ${row.title}`}
                  onClick={(event) => {
                    if (!(event.target as Element).closest("a,button"))
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
                      <span className="video-icon">
                        <AudioLines size={19} />
                      </span>
                      <span>
                        {row.title}
                        <small>
                          {t("Audio version")}{" "}
                          {row.edition.match(/-v(\d+)$/)?.[1]} ·{" "}
                          {row.version.locale.toUpperCase()} ·{" "}
                          {row.version.label}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>{row.version.code.toUpperCase()}</td>
                  <td className="muted">
                    {row.completedChapters} / {row.chapterCount}
                  </td>
                  <td>
                    <span className={`badge ${row.status}`}>
                      {statusLabel(row.status, language)}
                    </span>
                  </td>
                  <td>
                    <div className="project-publication-controls">
                      <AudioProjectMarker
                        row={row}
                        marks={marks}
                        toggle={toggle}
                      />
                      <button
                        type="button"
                        className="icon-button current-project-marker"
                        aria-label={`${t("Mark the next project")}: ${row.title}`}
                        data-tooltip={t(
                          lastProjects.has(row.id)
                            ? "There is no next project for this audio version."
                            : "Mark the next project in this audio version, ordered by ID.",
                        )}
                        disabled={
                          loading ||
                          advancing !== null ||
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
                    <UpdatedAt value={row.updatedAt} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading && <div className="empty">{t("Loading projects…")}</div>}
        {!loading && !ordered.length && !error && (
          <div className="empty">
            {t("Mark audio projects in Audios to see them here.")}{" "}
            <Link href="/audios">{t("Audios")}</Link>
          </div>
        )}
      </div>
    </section>
  );
}
