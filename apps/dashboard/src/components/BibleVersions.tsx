"use client";
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
} from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { userMessage } from "../lib/presentation";
import { bibleVersionSchema, type BibleVersion } from "../lib/bible-versions";

const languages = { es: "Spanish", en: "English", pt: "Portuguese" } as const;
export function BibleVersions() {
  const { t } = useI18n();
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const { isPinned, orderVersions, togglePin } = usePinnedBibleVersions();
  const displayedVersions = orderVersions(versions);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const syncItem = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<BibleVersion | "new" | null>(null);
  const [deleting, setDeleting] = useState<BibleVersion | null>(null);
  const load = useCallback(async () => {
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
    setNotice("");
    try {
      const result = await api<{ added: number }>("versions/sync", {
        method: "POST",
      });
      await load();
      setNotice(
        result.added
          ? `${t("New versions added:")} ${result.added}.`
          : t("There are no new versions to add."),
      );
    } catch (cause) {
      setError(userMessage(cause));
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
              setNotice("");
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
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {t(notice)}
        </p>
      )}
      <section className="panel">
        <div className="table-wrap">
          <table className="bible-versions-table">
            <thead>
              <tr>
                <th
                  className="version-pin-column"
                  aria-label={t("Pinned versions")}
                  data-tooltip={t("Pinned versions")}
                >
                  <Pin size={15} aria-hidden="true" />
                </th>
                <th>{t("Name")}</th>
                <th className="version-videos-column">{t("Videos")}</th>
                <th>{t("Language")}</th>
                <th>{t("Version code")}</th>
                <th>{t("Projects")}</th>
                <th>{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {displayedVersions.map((version) => (
                <tr
                  key={version.id}
                  className="bible-version-row"
                  tabIndex={0}
                  aria-label={`${t("Edit version")}: ${version.label}`}
                  onClick={() => {
                    setNotice("");
                    setEditing(version);
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setNotice("");
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
                  <td>{version.label}</td>
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
                  <td>{t(languages[version.locale])}</td>
                  <td>{version.code}</td>
                  <td>{version.project_count}</td>
                  <td>
                    <div className="project-top-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${t("Edit version")}: ${version.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setNotice("");
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
          {loading ? (
            <p className="empty">{t("Loading versions…")}</p>
          ) : (
            !versions.length && (
              <p className="empty">
                {t(
                  "There are no versions yet. Add one to start creating projects.",
                )}
              </p>
            )
          )}
        </div>
      </section>
      {editing && (
        <VersionDialog
          version={editing === "new" ? null : editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            setNotice("Version saved.");
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
            setNotice("Version deleted.");
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
