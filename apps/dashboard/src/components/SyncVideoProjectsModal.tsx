"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, X } from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { userMessage } from "../lib/presentation";
import type { BibleVersion } from "../lib/bible-versions";
export function SyncVideoProjectsModal({
  kind,
  selectedVersion,
  close,
  onSynced,
}: {
  kind: "short" | "long";
  selectedVersion: string;
  close: () => void;
  onSynced: (versionId: number) => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const initialVersion = useRef(selectedVersion);
  const [versions, setVersions] = useState<BibleVersion[]>([]),
    [version, setVersion] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; total: number } | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    api<{ versions: BibleVersion[] }>("versions")
      .then((data) => {
        if (live) {
          setVersions(data.versions);
          setVersion(
            String(
              data.versions.find(
                (row) => String(row.id) === initialVersion.current,
              )?.id ??
                data.versions[0]?.id ??
                "",
            ),
          );
        }
      })
      .catch((cause) => {
        if (live) setError(userMessage(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog voice-settings-dialog"
      aria-labelledby="sync-projects-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!version || busy) return;
          setBusy(true);
          setError("");
          setResult(null);
          try {
            const data = await api<{ added: number; total: number }>(
              `videos/sync?kind=${kind}`,
              {
                method: "POST",
                body: JSON.stringify({ versionId: Number(version) }),
              },
            );
            setResult(data);
            onSynced(Number(version));
          } catch (cause) {
            setError(userMessage(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="generation-queue-heading">
          <h2 id="sync-projects-title">
            {t("Sincronizar presets de proyectos")}
          </h2>
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
        <p className="muted">
          {t(
            "Se añadirán los pasajes propuestos que aún no tengan un proyecto para esta versión. Tus proyectos existentes conservarán todos sus cambios.",
          )}
        </p>
        <p className="eyebrow">
          {t(kind === "short" ? "Short Videos" : "Long Videos")}
        </p>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {loading ? (
          <p className="empty">{t("Cargando versiones…")}</p>
        ) : versions.length ? (
          <fieldset disabled={busy} className="voice-settings-fields">
            <label>
              {t("Versión bíblica")}
              <select
                required
                value={version}
                onChange={(event) => {
                  setVersion(event.target.value);
                  setResult(null);
                  setError("");
                }}
              >
                {versions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.locale.toUpperCase()} · {row.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        ) : (
          <p className="notice">
            {t(
              "Añade una versión de la Biblia antes de crear un proyecto. Si no tienes acceso, solicita ayuda al administrador.",
            )}
          </p>
        )}
        {result && (
          <p className="success" role="status">
            {result.added
              ? `${t("Proyectos nuevos añadidos:")} ${result.added}.`
              : t("No hay proyectos nuevos para añadir.")}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t("Cerrar")}
          </button>
          <button className="primary" disabled={loading || busy || !version}>
            {busy ? <LoaderCircle size={16} /> : <RefreshCw size={16} />}{" "}
            {t(
              busy
                ? "Sincronizando proyectos…"
                : "Sincronizar presets de proyectos",
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
