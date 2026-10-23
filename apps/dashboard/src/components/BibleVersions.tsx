"use client";
import { useToast } from "./ToastProvider";
import { useModalDismiss } from "./useModalDismiss";
import { usePinnedBibleVersions } from "./usePinnedBibleVersions";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  RefreshCw,
  MoreVertical,
  LoaderCircle,
  Clapperboard,
  Film,
  Pin,
  BookOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { userMessage } from "../lib/presentation";
import { bibleVersionSchema, type BibleVersion } from "../lib/bible-versions";

const languages = { es: "Spanish", en: "English", pt: "Portuguese" } as const;
export function BibleVersions() {
  const notify = useToast();
  const { t } = useI18n();
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const { isPinned, orderVersions, togglePin } = usePinnedBibleVersions();
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const search = query.trim().toLocaleLowerCase();
  const filteredVersions = orderVersions(versions).filter(
    (version) =>
      (locale === "all" || version.locale === locale) &&
      (!search ||
        `${version.label} ${version.code} ${version.locale} ${t(languages[version.locale])}`
          .toLocaleLowerCase()
          .includes(search)),
  );
  const pages = Math.max(1, Math.ceil(filteredVersions.length / pageSize));
  const currentPage = Math.min(page, pages);
  const displayedVersions = filteredVersions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  useEffect(() => {
    setPage((value) => Math.min(value, pages));
  }, [pages]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const syncItem = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<BibleVersion | "new" | null>(null);
  const [deleting, setDeleting] = useState<BibleVersion | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setVersions(
        (await api<{ versions: BibleVersion[] }>("versions")).versions,
      );
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!menuOpen) return;
    syncItem.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);
  const synchronize = async () => {
    setMenuOpen(false);
    setSyncing(true);
    setError("");
    try {
      const result = await api<{ added: number }>("versions/sync", {
        method: "POST",
      });
      await load();
      notify(
        result.added
          ? `${t("New versions added:")} ${result.added}.`
          : t("There are no new versions to add."),
      );
    } catch (cause) {
      notify(userMessage(cause), "error");
    } finally {
      setSyncing(false);
      menuTrigger.current?.focus();
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("SETTINGS")}</p>
          <h1>{t("Bible versions")}</h1>
          <p className="muted">
            {t("Manage the versions available for your video projects.")}
          </p>
        </div>
        <div className="project-top-actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              setEditing("new");
            }}
          >
            <Plus size={16} />
            {t("Add version")}
          </button>
          <div
            className="bible-versions-menu"
            ref={menu}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setMenuOpen(false);
            }}
          >
            <button
              ref={menuTrigger}
              type="button"
              className="icon-button"
              aria-label={t("Version options")}
              data-tooltip={
                syncing ? t("Syncing versions…") : t("Version options")
              }
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "bible-versions-menu" : undefined}
              disabled={syncing}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {syncing ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <MoreVertical size={18} />
              )}
            </button>
            {menuOpen && (
              <div
                role="menu"
                id="bible-versions-menu"
                className="bible-versions-dropdown"
                aria-label={t("Version options")}
              >
                <button
                  ref={syncItem}
                  type="button"
                  role="menuitem"
                  onClick={synchronize}
                >
                  <RefreshCw size={16} />
                  {t("Sync versions")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="video-summary">
        <div>
          <BookOpen size={21} />
          <strong>{versions.length}</strong>
          <span>{t("Bible versions")}</span>
        </div>
        <div>
          <Pin size={17} />
          <strong>{versions.filter(isPinned).length}</strong>
          <span>{t("Pinned versions")}</span>
        </div>
        <div>
          <Clapperboard size={17} />
          <strong>
            {versions.reduce(
              (total, version) => total + version.project_count,
              0,
            )}
          </strong>
          <span>{t("Projects")}</span>
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
      <section className="panel catalog-panel" aria-busy={loading}>
        <div className="catalog-toolbar">
          <div className="search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label={t("Search versions")}
              placeholder={t("Search versions")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label={t("Language")}
            value={locale}
            onChange={(event) => {
              setLocale(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t("All languages")}</option>
            {Object.entries(languages).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table className="catalog bible-versions-table">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="version-pin-column"
                  aria-label={t("Pinned versions")}
                  data-tooltip={t("Pinned versions")}
                >
                  <Pin size={15} aria-hidden="true" />
                </th>
                <th scope="col">{t("Name")}</th>
                <th scope="col" className="version-videos-column">
                  {t("Videos")}
                </th>
                <th scope="col">{t("Language")}</th>
                <th scope="col">{t("Version code")}</th>
                <th scope="col">{t("Projects")}</th>
                <th scope="col">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {displayedVersions.map((version) => (
                <tr
                  key={version.id}
                  className="bible-version-row"
                  tabIndex={0}
                  aria-label={`${t("Edit version")}: ${version.label}`}
                  onClick={(event) => {
                    if (
                      !(event.target as Element).closest(
                        "a,button,input,label,select",
                      )
                    )
                      setEditing(version);
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setEditing(version);
                    }
                  }}
                >
                  <td className="version-pin-column">
                    <button
                      type="button"
                      className={`icon-button version-pin-button${isPinned(version) ? " pinned" : ""}`}
                      aria-pressed={isPinned(version)}
                      aria-label={`${t(isPinned(version) ? "Unpin version" : "Pin version")}: ${version.label}`}
                      data-tooltip={t(
                        isPinned(version) ? "Unpin version" : "Pin version",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePin(version);
                      }}
                    >
                      <Pin size={16} aria-hidden="true" />
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="project-name"
                      aria-label={`${t("Edit version")}: ${version.label}`}
                      onClick={() => setEditing(version)}
                    >
                      <span className="video-icon">
                        <BookOpen size={19} aria-hidden="true" />
                      </span>
                      <span>
                        {version.label}
                        <small className="muted">
                          {version.locale.toUpperCase()} ·{" "}
                          {version.code.toUpperCase()}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td className="version-videos-column">
                    <div className="version-video-links">
                      <Link
                        href={`/short-videos?version=${version.id}`}
                        className="button icon-button"
                        aria-label={`${t("View short videos")}: ${version.label}`}
                        data-tooltip={t("View short videos")}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Clapperboard size={16} aria-hidden="true" />
                      </Link>
                      <Link
                        href={`/long-videos?version=${version.id}`}
                        className="button icon-button"
                        aria-label={`${t("View long videos")}: ${version.label}`}
                        data-tooltip={t("View long videos")}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Film size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                  <td>
                    <span className="badge">
                      {t(languages[version.locale])}
                    </span>
                  </td>
                  <td className="muted">{version.code.toUpperCase()}</td>
                  <td className="muted">{version.project_count}</td>
                  <td>
                    <div className="project-top-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${t("Edit version")}: ${version.label}`}
                        data-tooltip={t("Edit version")}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(version);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={version.project_count > 0}
                        data-tooltip={
                          version.project_count
                            ? t("This version has associated projects.")
                            : t("Delete version")
                        }
                        aria-label={`${t("Delete version")}: ${version.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleting(version);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="empty">{t("Loading versions…")}</div>}
          {!loading && !displayedVersions.length && !error && (
            <div className="empty">
              {versions.length
                ? t("No Bible versions match these filters.")
                : t(
                    "There are no versions yet. Add one to start creating projects.",
                  )}
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filteredVersions.length} {t("versions · page")} {currentPage}{" "}
            {t("of")} {pages}
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
              disabled={loading || currentPage === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Previous page")}
              disabled={loading || currentPage === 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Next page")}
              disabled={loading || currentPage >= pages}
              onClick={() => setPage(Math.min(pages, currentPage + 1))}
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Last page")}
              data-tooltip={t("Last page")}
              disabled={loading || currentPage >= pages}
              onClick={() => setPage(pages)}
            >
              <ChevronsRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
      {editing && (
        <VersionDialog
          version={editing === "new" ? null : editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            notify("Version saved.");
            void load();
          }}
        />
      )}
      {deleting && (
        <VersionDialog
          version={deleting}
          deleting
          close={() => setDeleting(null)}
          saved={() => {
            setDeleting(null);
            notify("Version deleted.");
            void load();
          }}
        />
      )}
    </>
  );
}
function VersionDialog({
  version,
  deleting = false,
  close,
  saved,
}: {
  version: BibleVersion | null;
  deleting?: boolean;
  close: () => void;
  saved: () => void;
}) {
  const { t } = useI18n();
  const dismiss = useModalDismiss(close);
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState({
    locale: version?.locale ?? "es",
    code: version?.code ?? "",
    label: version?.label ?? "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = Boolean(version?.project_count);
  useEffect(() => {
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  const title = deleting
    ? "Delete version"
    : version
      ? "Edit version"
      : "Add version";
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog voice-settings-dialog"
      aria-labelledby="version-dialog-title"
      {...dismiss}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (!deleting && !bibleVersionSchema.safeParse(values).success) {
            setError("Check the version name, language and code.");
            return;
          }
          setBusy(true);
          try {
            await api(`versions${version ? `/${version.id}` : ""}`, {
              method: deleting ? "DELETE" : version ? "PATCH" : "POST",
              ...(!deleting ? { body: JSON.stringify(values) } : {}),
            });
            saved();
          } catch (cause) {
            setError(userMessage(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="generation-queue-heading">
          <h2 id="version-dialog-title">{t(title)}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Close")}
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {deleting ? (
          <p>
            {t("Do you want to delete this version?")}{" "}
            <strong>{version?.label}</strong>
          </p>
        ) : (
          <fieldset disabled={busy} className="voice-settings-fields">
            <label>
              {t("Name")}
              <input
                required
                maxLength={120}
                value={values.label}
                onChange={(event) =>
                  setValues({ ...values, label: event.target.value })
                }
                placeholder="Reina-Valera 1909"
              />
            </label>
            <label>
              {t("Language")}
              <select
                disabled={locked}
                value={values.locale}
                onChange={(event) =>
                  setValues({
                    ...values,
                    locale: event.target.value as BibleVersion["locale"],
                  })
                }
              >
                {Object.entries(languages).map(([locale, label]) => (
                  <option key={locale} value={locale}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Version code")}
              <input
                required
                maxLength={60}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                disabled={locked}
                value={values.code}
                onChange={(event) =>
                  setValues({ ...values, code: event.target.value })
                }
                placeholder="rv1909"
              />
              <small className="muted">
                {t(
                  "Use the code of the available Bible version: lowercase letters, numbers and hyphens, without spaces.",
                )}
              </small>
            </label>
            {locked && (
              <p className="notice">
                {t(
                  "This version has associated projects. You can change its name, but you cannot change its language or code or delete it.",
                )}
              </p>
            )}
          </fieldset>
        )}
        <div className="modal-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t("Cancel")}
          </button>
          <button className="primary" disabled={busy}>
            {deleting ? <Trash2 size={16} /> : <Save size={16} />}
            {busy
              ? t("Saving…")
              : deleting
                ? t("Delete version")
                : t("Save changes")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
