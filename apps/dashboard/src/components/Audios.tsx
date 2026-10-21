"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AudioLines,
  Plus,
  Search,
  X,
  ArrowRight,
  LoaderCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { AudioVersion } from "../../../../tools/video-project-api/src/audio-project-schema";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { useToast } from "./ToastProvider";
import { useModalDismiss } from "./useModalDismiss";
import { statusLabel } from "../lib/presentation";
import { audioEditionSchema } from "../../../../tools/video-project-api/src/audio-project-schema";
import type { AudioCatalog, AudioCatalogRow } from "../lib/audio-listing";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "./useDebouncedValue";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";
import { VideoProjectMenu } from "./VideoProjectMenu";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
import { UpdatedAt } from "./UpdatedAt";
export type AudioVersionOption = AudioVersion & {
  edition: string;
  number: number;
};
function CreateAudioProjects({
  close,
  created,
}: {
  close: () => void;
  created: (edition: string) => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<AudioVersionOption[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const dismiss = useModalDismiss(() => {
    if (!busy) close();
  });
  const load = async () => {
    const data = await api<{ versions: AudioVersionOption[] }>(
      "audios/options",
    );
    setOptions(data.versions);
    setSelected((current) =>
      data.versions.some((v) => v.id === current)
        ? current
        : (data.versions[0]?.id ?? 0),
    );
  };
  useEffect(() => {
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void load()
      .catch(() => setError("Could not load audio versions. Try again."))
      .finally(() => setLoading(false));
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const option = options.find((v) => v.id === selected);
  return (
    <dialog
      ref={dialog}
      {...dismiss}
      className="generation-queue-dialog voice-settings-dialog"
      aria-labelledby="create-audio-title"
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!option || busy) return;
          setBusy(true);
          setError("");
          try {
            const result = await api<{ edition: string }>("audios", {
              method: "POST",
              body: JSON.stringify({
                versionId: selected,
                edition: option.edition,
              }),
            });
            created(result.edition);
          } catch {
            setError(
              "Could not create audio projects. Reload the available versions and try again.",
            );
            await load().catch(() => {});
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="generation-queue-heading">
          <h2 id="create-audio-title">{t("Create audio projects")}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Close")}
            onClick={close}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">
          {t(
            "Create one audio project for each book in a new audio version. Original recordings and previous audio versions are preserved.",
          )}
        </p>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {loading ? (
          <p className="empty">{t("Loading versions…")}</p>
        ) : (
          <fieldset
            className="voice-settings-fields"
            disabled={busy || !options.length}
          >
            <label>
              {t("Bible version")}
              <select
                value={selected}
                onChange={(event) => setSelected(Number(event.target.value))}
              >
                {options.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.locale.toUpperCase()} · {v.label} · {t("Audio version")}{" "}
                    {v.number}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        )}
        {!loading && !options.length && (
          <p className="notice">
            {t("Add a Bible version before creating audio projects.")}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" onClick={close} disabled={busy}>
            {t("Cancel")}
          </button>
          <button className="primary" disabled={busy || loading || !option}>
            {busy ? (
              <LoaderCircle size={16} className="voice-spinner" />
            ) : (
              <Plus size={16} />
            )}
            {t("Create audio projects")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function editionFilter(value: string | null) {
  return value && audioEditionSchema.safeParse(value).success ? value : "all";
}
export function Audios() {
  const { t, language } = useI18n(),
    notify = useToast();
  const router = useRouter(),
    searchParams = useSearchParams();
  const requestedEdition = searchParams.get("edition");
  const { orderVersions } = usePinnedBibleVersions();
  const [catalog, setCatalog] = useState<AudioCatalog>({
    projects: [],
    editions: [],
    pagination: { page: 1, pageSize: 10, total: 0, pages: 1 },
    summary: { total: 0, generated: 0, pending: 0 },
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canEditSettings, setCanEditSettings] = useState(false);
  useEffect(() => {
    let live = true;
    void api("auth/me")
      .then((data) => {
        if (live) setCanEditSettings(data.user.role === "admin");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const [create, setCreate] = useState(false),
    [edition, setEdition] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [revision, setRevision] = useState(0);
  const debouncedQuery = useDebouncedValue(query);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    let value = editionFilter(requestedEdition);
    try {
      if (requestedEdition === null)
        value = editionFilter(localStorage.getItem("veo-audio-edition-filter"));
      localStorage.setItem("veo-audio-edition-filter", value);
    } catch {}
    setEdition(value);
    setPage(1);
  }, [requestedEdition]);
  const selectEdition = (value: string) => {
    const next = editionFilter(value);
    setEdition(next);
    setPage(1);
    try {
      localStorage.setItem("veo-audio-edition-filter", next);
    } catch {}
    const params = new URLSearchParams(searchParams.toString());
    params.set("edition", next);
    router.replace(`/audios?${params}`, { scroll: false });
  };
  const load = useCallback(async () => {
    request.current?.abort();
    if (edition === null || query !== debouncedQuery) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        catalog: "1",
        edition,
        query: debouncedQuery,
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await api<AudioCatalog>(`audios?${params}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setCatalog(data);
      setError("");
      if (data.pagination.page !== page) setPage(data.pagination.page);
    } catch {
      if (!controller.signal.aborted)
        setError(
          "Could not load audio projects. Check that generation is available and try again.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [edition, query, debouncedQuery, status, page, pageSize, revision]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  const { projects: rows, editions, pagination, summary } = catalog;
  const href = (row: AudioCatalogRow) => `/audios/${row.edition}/${row.book}`;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("YOUR PROJECTS")}</p>
          <h1>{t("Audios")}</h1>
          <p className="muted">
            {t("Prepare chapter recordings to use in your videos.")}
          </p>
        </div>
        <div className="project-top-actions">
          <button
            type="button"
            className="primary"
            onClick={() => setCreate(true)}
          >
            <Plus size={17} />
            {t("Create audio projects")}
          </button>
          <VideoProjectMenu onSettings={() => setSettingsOpen(true)} />
        </div>
      </div>
      <div className="video-summary">
        <div>
          <AudioLines size={21} />
          <strong>{summary.total}</strong>
          <span>{t("books")}</span>
        </div>
        <div>
          <span className="dot green" />
          <strong>{summary.pending}</strong>
          <span>{t("Pending")}</span>
        </div>
        <div>
          <Check size={17} />
          <strong>{summary.generated}</strong>
          <span>{t("Generated")}</span>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}{" "}
          <button type="button" onClick={() => void load()}>
            {t("Retry")}
          </button>
        </p>
      )}
      <section className="panel catalog-panel">
        <div className="catalog-toolbar">
          <div className="search">
            <Search size={17} />
            <input
              aria-label={t("Search books")}
              placeholder={t("Search books")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label={t("Audio version")}
            value={edition ?? "all"}
            disabled={edition === null}
            onChange={(event) => selectEdition(event.target.value)}
          >
            <option value="all">{t("All versions")}</option>
            {edition &&
              edition !== "all" &&
              !editions.some((option) => option.edition === edition) && (
                <option value={edition}>
                  {t("Audio version")} {edition.match(/-v(\d+)$/)?.[1]}
                </option>
              )}
            {orderVersions(editions).map((option) => (
              <option key={option.edition} value={option.edition}>
                {option.locale.toUpperCase()} · {option.label} ·{" "}
                {t("Audio version")} {option.number}
              </option>
            ))}
          </select>
          <select
            aria-label={t("Filter status")}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t("All projects")}</option>
            {["draft", "queued", "running", "done", "failed"].map((value) => (
              <option value={value} key={value}>
                {statusLabel(value, language)}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">{t("Audio project")}</th>
                <th scope="col">{t("Bible version")}</th>
                <th scope="col">{t("Chapters")}</th>
                <th scope="col">{t("Status")}</th>
                <th scope="col">{t("Updated")}</th>
                <th scope="col">
                  <span className="sr-only">{t("Open project")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="video-project-row"
                  tabIndex={0}
                  aria-label={`${t("Open project")}: ${row.title}`}
                  onClick={(event) => {
                    if (
                      !(event.target as Element).closest(
                        "a,button,input,label,select",
                      )
                    )
                      router.push(href(row));
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
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
                  <td className="muted">
                    <UpdatedAt value={row.updatedAt} />
                  </td>
                  <td>
                    <Link
                      className="button icon-button"
                      href={href(row)}
                      aria-label={`${t("Open project")}: ${row.title}`}
                    >
                      <ArrowRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="empty">{t("Loading projects…")}</div>}
          {!loading && !rows.length && !error && (
            <div className="empty">
              {summary.total === 0 &&
              edition === "all" &&
              !query &&
              status === "all"
                ? t(
                    "Create a new audio version to start preparing chapter recordings.",
                  )
                : t("No audio projects match these filters.")}
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
              disabled={loading || pagination.page === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Previous page")}
              disabled={loading || pagination.page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Next page")}
              disabled={loading || pagination.page >= pagination.pages}
              onClick={() =>
                setPage((value) => Math.min(pagination.pages, value + 1))
              }
            >
              <ChevronRight size={17} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Last page")}
              data-tooltip={t("Last page")}
              disabled={loading || pagination.page >= pagination.pages}
              onClick={() => setPage(pagination.pages)}
            >
              <ChevronsRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
      {settingsOpen && (
        <VoiceSettingsModal
          kind="audio"
          canEdit={canEditSettings}
          close={() => setSettingsOpen(false)}
        />
      )}
      {create && (
        <CreateAudioProjects
          close={() => setCreate(false)}
          created={(value) => {
            setCreate(false);
            setQuery("");
            setStatus("all");
            setPage(1);
            selectEdition(value);
            setRevision((current) => current + 1);
            notify("Audio projects created.", "success");
          }}
        />
      )}
    </>
  );
}
