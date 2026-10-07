"use client";
import { useI18n } from "../../../i18n/context";
import { useCallback, useEffect, useRef, useState } from "react";
import { Rocket, RefreshCw, Settings, X } from "lucide-react";
import { api, date } from "../../../components/api";
import { statusLabel, userMessage } from "../../../lib/presentation";
interface Deployment {
  trackable: number;
  id: string;
  status: string;
  message: string;
  created_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  created_by_name: string | null;
}
interface Data {
  configured: boolean;
  trackingAvailable: boolean;
  syncError: boolean;
  deployments: Deployment[];
}
export default function Deployments() {
  const { t, language } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"config" | "publish" | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [message, setMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<Data>("deployments"));
      setError("");
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  const configure = async () => {
    setBusy(true);
    setError("");
    try {
      const settings = await api<{ hookUrl: string }>("deployments/settings");
      setHookUrl(settings.hookUrl);
      setModalError("");
      setModal("config");
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const save = async (value: string) => {
    setBusy(true);
    setModalError("");
    try {
      await api("deployments/settings", {
        method: "POST",
        body: JSON.stringify({ hookUrl: value.trim() }),
      });
      setModal(null);
      setNotice("Ajustes guardados.");
      await load();
    } catch (e) {
      setModalError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    setBusy(true);
    setModalError("");
    setNotice("");
    try {
      const result = await api<{ status: string }>("deployments", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setModal(null);
      if (result.status === "failed")
        setNotice("No se pudo solicitar la actualización. Inténtalo de nuevo.");
      else if (result.status === "unknown")
        setNotice(
          "No se pudo confirmar la solicitud. Revisa las actualizaciones publicadas antes de reintentar.",
        );
      else
        setNotice(
          "Solicitud enviada. La publicación está pendiente de confirmación.",
        );
      await load();
    } catch (e) {
      setModalError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const latest = data?.deployments.find((d) => d.status === "success");
  const active = data?.deployments.find(
    (d) =>
      Boolean(d.trackable) &&
      ["requested", "queued", "building", "deploying"].includes(d.status),
  );
  const openPublication = () => {
    setMessage("");
    setModalError("");
    setModal("publish");
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("GESTIÓN DE LA PLATAFORMA")}</p>
          <h1>{t("Actualizaciones")}</h1>
          <p className="muted">
            {t("Publica los cambios del sitio público y consulta su progreso.")}
          </p>
        </div>
        <div className="deployment-actions">
          <button onClick={load} disabled={loading}>
            <RefreshCw size={16} />
            {t("Actualizar")}
          </button>
          <button
            type="button"
            aria-label={t("Configurar")}
            title={t("Configurar")}
            onClick={configure}
            disabled={busy}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          <button
            className="primary"
            onClick={openPublication}
            disabled={
              !data?.configured ||
              busy ||
              Boolean(active && data?.trackingAvailable)
            }
          >
            <Rocket size={16} />
            {t("Publicar actualización")}
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
      <section className="panel">
        <h3>{t("Última versión publicada")}</h3>
        <p className="muted">
          {latest
            ? date(latest.completed_at || latest.created_at, language)
            : t("Todavía no hay publicaciones completadas.")}
        </p>
        {latest?.message && <p>{latest.message}</p>}
        {active && (
          <p className="notice">
            {t("Hay una actualización en curso.")}{" "}
            {t(statusLabel(active.status))}
          </p>
        )}
        {data && !data.trackingAvailable && (
          <p className="muted">
            {t(
              "El seguimiento automático no está disponible. Comprueba el sitio antes de volver a publicar.",
            )}
          </p>
        )}
        {data?.syncError && (
          <p className="error">
            {t(
              "No se pudo consultar el historial de actualizaciones. Inténtalo de nuevo más tarde.",
            )}
          </p>
        )}
      </section>
      <section className="panel">
        <h3>{t("Historial de publicaciones")}</h3>
        <div className="deployment-table">
          <table>
            <thead>
              <tr>
                <th>{t("Fecha")}</th>
                <th>{t("Estado")}</th>
                <th>{t("Duración")}</th>
                <th>{t("Publicado por")}</th>
                <th>{t("Nota")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.deployments.map((d) => (
                <tr key={d.id}>
                  <td>{date(d.created_at, language)}</td>
                  <td>
                    <span className="badge">{t(statusLabel(d.status))}</span>
                  </td>
                  <td>
                    {d.duration_ms === null
                      ? "—"
                      : `${Math.round(d.duration_ms / 1000)} s`}
                  </td>
                  <td>{d.created_by_name || "—"}</td>
                  <td>{d.message || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data && <p className="empty">{t("Cargando historial…")}</p>}
        {data?.deployments.length === 0 && (
          <p className="empty">
            {t("Todavía no hay solicitudes de actualización.")}
          </p>
        )}
      </section>
      <dialog
        ref={dialog}
        className="modal small deployment-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setModal(null);
        }}
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (modal === "config" ? save(hookUrl) : publish());
          }}
        >
          <div className="modal-title">
            <h2>
              {t(
                modal === "config"
                  ? "Configurar publicación"
                  : "Publicar actualización",
              )}
            </h2>
            <button
              type="button"
              aria-label={t("Cerrar")}
              disabled={busy}
              onClick={() => setModal(null)}
            >
              <X size={18} />
            </button>
          </div>
          {modalError && (
            <p className="error" role="alert">
              {t(modalError)}
            </p>
          )}
          {modal === "config" ? (
            <>
              <p className="muted">
                {t(
                  "Pega el enlace de publicación del sitio público. Los ajustes se conservan para las próximas publicaciones.",
                )}
              </p>
              <label>
                {t("Enlace de publicación")}
                <input
                  type="url"
                  autoComplete="off"
                  value={hookUrl}
                  maxLength={2048}
                  disabled={busy}
                  onChange={(e) => setHookUrl(e.target.value)}
                />
              </label>
              <p className="muted">
                {t(
                  "Usa el enlace del sitio VeoBible, con dirección segura https://.",
                )}
              </p>
            </>
          ) : (
            <>
              <p className="muted">
                {t("Se publicarán los cambios actuales en veobible.com.")}
              </p>
              <label>
                {t("Nota de publicación (opcional)")}
                <textarea
                  value={message}
                  maxLength={500}
                  disabled={busy}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
            </>
          )}
          <div className="modal-footer">
            {modal === "config" && (
              <button
                type="button"
                disabled={busy || !hookUrl}
                onClick={() => void save("")}
              >
                {t("Desactivar publicación")}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              {t("Cerrar")}
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {t(
                busy
                  ? "Procesando…"
                  : modal === "config"
                    ? "Guardar cambios"
                    : "Confirmar y publicar",
              )}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
