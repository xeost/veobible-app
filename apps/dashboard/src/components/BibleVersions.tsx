"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  RefreshCw,
  MoreVertical,
  LoaderCircle,
} from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { userMessage } from "../lib/presentation";
import { bibleVersionSchema, type BibleVersion } from "../lib/bible-versions";

const languages = { es: "Español", en: "Inglés", pt: "Portugués" } as const;
export function BibleVersions() {
  const { t } = useI18n();
  const [versions, setVersions] = useState<BibleVersion[]>([]);
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
          ? `${t("Versiones nuevas añadidas:")} ${result.added}.`
          : t("No hay versiones nuevas para añadir."),
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
          <p className="eyebrow">{t("CONFIGURACIÓN")}</p>
          <h1>{t("Versiones de la Biblia")}</h1>
          <p className="muted">
            {t(
              "Administra las versiones disponibles para tus proyectos de video.",
            )}
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
            {t("Añadir versión")}
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
              aria-label={t("Opciones de versiones")}
              title={t(
                syncing ? "Sincronizando versiones…" : "Opciones de versiones",
              )}
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
                aria-label={t("Opciones de versiones")}
              >
                <button
                  ref={syncItem}
                  type="button"
                  role="menuitem"
                  onClick={synchronize}
                >
                  <RefreshCw size={16} />
                  {t("Sincronizar versiones")}
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
                <th>{t("Nombre")}</th>
                <th>{t("Idioma")}</th>
                <th>{t("Código de versión")}</th>
                <th>{t("Proyectos")}</th>
                <th>{t("Acciones")}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr
                  key={version.id}
                  className="bible-version-row"
                  tabIndex={0}
                  aria-label={`${t("Editar versión")}: ${version.label}`}
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
                  <td>{version.label}</td>
                  <td>{t(languages[version.locale])}</td>
                  <td>{version.code}</td>
                  <td>{version.project_count}</td>
                  <td>
                    <div className="project-top-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${t("Editar versión")}: ${version.label}`}
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
                        title={t(
                          version.project_count
                            ? "Esta versión tiene proyectos asociados."
                            : "Eliminar versión",
                        )}
                        aria-label={`${t("Eliminar versión")}: ${version.label}`}
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
            <p className="empty">{t("Cargando versiones…")}</p>
          ) : (
            !versions.length && (
              <p className="empty">
                {t(
                  "Todavía no hay versiones. Añade una para comenzar a crear proyectos.",
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
            setNotice("Versión guardada.");
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
            setNotice("Versión eliminada.");
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
    ? "Eliminar versión"
    : version
      ? "Editar versión"
      : "Añadir versión";
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog voice-settings-dialog"
      aria-labelledby="version-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (!deleting && !bibleVersionSchema.safeParse(values).success) {
            setError("Revisa el nombre, el idioma y el código de la versión.");
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
            aria-label={t("Cerrar")}
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
            {t("¿Quieres eliminar esta versión?")}{" "}
            <strong>{version?.label}</strong>
          </p>
        ) : (
          <fieldset disabled={busy} className="voice-settings-fields">
            <label>
              {t("Nombre")}
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
              {t("Idioma")}
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
              {t("Código de versión")}
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
                  "Usa el código de la versión bíblica disponible: letras minúsculas, números y guiones, sin espacios.",
                )}
              </small>
            </label>
            {locked && (
              <p className="notice">
                {t(
                  "Esta versión tiene proyectos asociados. Puedes cambiar su nombre, pero no su idioma o código ni eliminarla.",
                )}
              </p>
            )}
          </fieldset>
        )}
        <div className="modal-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t("Cancelar")}
          </button>
          <button className="primary" disabled={busy}>
            {deleting ? <Trash2 size={16} /> : <Save size={16} />}
            {t(
              busy
                ? "Guardando…"
                : deleting
                  ? "Eliminar versión"
                  : "Guardar cambios",
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
