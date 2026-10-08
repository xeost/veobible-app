"use client";
import { useModalDismiss } from "../../../components/useModalDismiss";
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
  const dismiss = useModalDismiss(() => setModal(null));
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
      setNotice("Settings saved.");
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
        setNotice("Could not request the update. Please try again.");
      else if (result.status === "unknown")
        setNotice(
          "Could not confirm the request. Check published updates before trying again.",
        );
      else setNotice("Request sent. Publication is awaiting confirmation.");
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
          <p className="eyebrow">{t("PLATFORM MANAGEMENT")}</p>
          <h1>{t("Updates")}</h1>
          <p className="muted">
            {t("Publish public site changes and track their progress.")}
          </p>
        </div>
        <div className="deployment-actions">
          <button onClick={load} disabled={loading}>
            <RefreshCw size={16} />
            {t("Refresh")}
          </button>
          <button
            type="button"
            aria-label={t("Configure")}
            data-tooltip={t("Configure")}
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
            {t("Publish update")}
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
        <h3>{t("Latest published version")}</h3>
        <p className="muted">
          {latest
            ? date(latest.completed_at || latest.created_at, language)
            : t("No completed publications yet.")}
        </p>
        {latest?.message && <p>{latest.message}</p>}
        {active && (
          <p className="notice">
            {t("An update is in progress.")} {t(statusLabel(active.status))}
          </p>
        )}
        {data && !data.trackingAvailable && (
          <p className="muted">
            {t(
              "Automatic tracking is unavailable. Check the site before publishing again.",
            )}
          </p>
        )}
        {data?.syncError && (
          <p className="error">
            {t("Could not load update history. Try again later.")}
          </p>
        )}
      </section>
      <section className="panel">
        <h3>{t("Publication history")}</h3>
        <div className="deployment-table">
          <table>
            <thead>
              <tr>
                <th>{t("Date")}</th>
                <th>{t("Status")}</th>
                <th>{t("Duration")}</th>
                <th>{t("Published by")}</th>
                <th>{t("Note")}</th>
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
        {!data && <p className="empty">{t("Loading history…")}</p>}
        {data?.deployments.length === 0 && (
          <p className="empty">{t("No update requests yet.")}</p>
        )}
      </section>
      <dialog
        ref={dialog}
        className="modal small deployment-dialog"
        {...dismiss}
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
              {modal === "config"
                ? t("Configure publishing")
                : t("Publish update")}
            </h2>
            <button
              type="button"
              aria-label={t("Close")}
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
                  "Paste the public site publishing link. Settings are saved for future publications.",
                )}
              </p>
              <label>
                {t("Publishing link")}
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
                  "Use the VeoBible site link with a secure https:// address.",
                )}
              </p>
            </>
          ) : (
            <>
              <p className="muted">
                {t("Current changes will be published to veobible.com.")}
              </p>
              <label>
                {t("Publication note (optional)")}
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
                {t("Disable publishing")}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              {t("Close")}
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy
                ? t("Processing…")
                : modal === "config"
                  ? t("Save changes")
                  : t("Confirm and publish")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
