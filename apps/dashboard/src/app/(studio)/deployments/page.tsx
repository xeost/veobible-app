"use client";
import Link from "next/link";
import { useToast } from "../../../components/ToastProvider";
import { pollWhileVisible } from "../../../lib/visible-polling";
import { useModalDismiss } from "../../../components/useModalDismiss";
import { useI18n } from "../../../i18n/context";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Rocket,
  RefreshCw,
  Settings,
  X,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  ArrowRight,
} from "lucide-react";
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
  website: {
    changes: { action: string; title: string; path: string }[];
    ready: number;
    blocked: number;
    books: number;
    revision: string;
    pages: { title: string; path?: string; issue?: string }[];
  };
  devBuild: { available: boolean; changed: boolean } | null;
  configured: boolean;
  trackingAvailable: boolean;
  syncError: boolean;
  deployments: Deployment[];
}
export default function Deployments() {
  const notify = useToast();
  const { t, language } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"config" | "publish" | "resolve" | null>(
    null,
  );
  const [stopped, setStopped] = useState(false);
  const [hookUrl, setHookUrl] = useState("");
  const [message, setMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const dismiss = useModalDismiss(() => {
    if (!busy) setModal(null);
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await api<Data>("deployments", {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setData(result);
        setError("");
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(userMessage(cause));
    }
  }, []);
  useEffect(() => {
    const stop = pollWhileVisible(load, () => true, 15000);
    return () => {
      stop();
      request.current?.abort();
    };
  }, [load]);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    } else dialog.current?.close();
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
      notify("Settings saved.");
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
    try {
      const result = await api<{ status: string }>("deployments", {
        method: "POST",
        body: JSON.stringify({
          message,
          expectedRevision: data?.website.revision,
        }),
      });
      setModal(null);
      if (result.status === "failed")
        notify("Could not request the update. Please try again.", "error");
      else if (result.status === "unknown")
        notify(
          "Could not confirm the request. Check published updates before trying again.",
          "info",
        );
      else
        notify("Request sent. Publication is awaiting confirmation.", "info");
      await load();
    } catch (e) {
      setModalError(userMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const devBuild = async () => {
    setBusy(true);
    setError("");
    try {
      await api("deployments/dev-build", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: data?.website.revision }),
      });
      notify("Development content updated.");
      await load();
    } catch (cause) {
      setError(userMessage(cause));
      await load();
    } finally {
      setBusy(false);
    }
  };
  const resolvePending = async () => {
    if (!active || !stopped) return;
    setBusy(true);
    setModalError("");
    try {
      await api(`deployments/${active.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ stopped: true }),
      });
      setModal(null);
      await load();
    } catch (error) {
      setModalError(userMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const latest = data?.deployments.find((d) => d.status === "success");
  const active = data?.deployments.find((d) =>
    ["requested", "queued", "building", "deploying", "unknown"].includes(
      d.status,
    ),
  );
  const devBuildHelp = busy
    ? "Processing…"
    : !data?.devBuild?.available
      ? "Could not connect to the local site. Restart the development services and try again."
      : data.website.blocked
        ? "Review or exclude the included pages that need attention."
        : !data.devBuild.changed
          ? "The local site already has these changes."
          : "Apply saved website changes to the local site.";
  const openPublication = () => {
    setMessage("");
    setModalError("");
    setModal("publish");
  };
  return (
    <div className="deployments-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("PLATFORM MANAGEMENT")}</p>
          <h1>{t("Updates")}</h1>
          <p className="muted">
            {t("Publish public site changes and track their progress.")}
          </p>
        </div>
        <div className="deployment-actions">
          {data?.devBuild && (
            <span data-tooltip={t(devBuildHelp)} tabIndex={0}>
              <button
                type="button"
                onClick={devBuild}
                disabled={
                  busy ||
                  !data.devBuild.available ||
                  !data.devBuild.changed ||
                  Boolean(data.website.blocked)
                }
              >
                <RefreshCw size={16} />
                {t("Dev Build")}
              </button>
            </span>
          )}
          <button
            className="primary"
            onClick={openPublication}
            disabled={
              !data?.configured ||
              busy ||
              Boolean(active) ||
              Boolean(data?.website.blocked)
            }
          >
            <Rocket size={16} />
            {t("Publish update")}
          </button>
          <button
            type="button"
            aria-label={t("Configure")}
            data-tooltip={t("Configure")}
            className="icon-button"
            onClick={configure}
            disabled={busy}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="deployments-overview">
        <section className="panel deployment-content-panel">
          <div className="panel-heading">
            <h3>{t("Website content")}</h3>
            <Link href="/website" className="deployment-review-link">
              {t("Review website pages")}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="deployment-content-summary">
            <div
              tabIndex={0}
              data-tooltip={t(
                "Included pages with a valid YouTube link, passage, Bible version and episode when required. They will be added or updated when you publish.",
              )}
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              <strong>{data?.website.ready ?? 0}</strong>
              <span>{t("Ready")}</span>
            </div>
            <div
              tabIndex={0}
              data-tooltip={t(
                "Included pages with a missing or invalid YouTube link, passage, Bible version or episode. They block publishing and Dev Build. Review them in Website or exclude them; excluded pages are not counted.",
              )}
            >
              <AlertCircle size={18} aria-hidden="true" />
              <strong>{data?.website.blocked ?? 0}</strong>
              <span>{t("Needs review")}</span>
            </div>
            <div
              tabIndex={0}
              data-tooltip={t(
                "Book video links available for each Bible version, including existing links and detected links from published book video projects. These do not create pages in either series.",
              )}
            >
              <BookOpen size={18} aria-hidden="true" />
              <strong>{data?.website.books ?? 0}</strong>
              <span>{t("Bible book videos")}</span>
            </div>
          </div>
          <p className="muted">
            {t(
              "Publishing an update applies the latest changes to all included pages. Pages are removed if you exclude them or their video project is no longer marked as published on social media.",
            )}
          </p>
          {Boolean(data?.website.changes.length) && (
            <ul className="deployment-changes">
              {data?.website.changes.map((p) => (
                <li key={p.path}>
                  <span className="badge">{t(p.action)}</span>
                  <span>{p.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel deployment-latest-panel">
          <div className="panel-heading">
            <h3>{t("Latest published version")}</h3>
            <Rocket size={18} aria-hidden="true" />
          </div>
          <p className="muted">
            {latest
              ? date(latest.completed_at || latest.created_at, language)
              : t("No completed publications yet.")}
          </p>
          {latest?.message && (
            <p className="deployment-note">{latest.message}</p>
          )}
          {active && (
            <div className="notice deployment-pending">
              <span>
                {t("An update is in progress.")} {t(statusLabel(active.status))}
              </span>
              {(active.status === "unknown" ||
                !data?.trackingAvailable ||
                data?.syncError) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStopped(false);
                    setModalError("");
                    setModal("resolve");
                  }}
                >
                  {t("Resolve pending update")}
                </button>
              )}
            </div>
          )}
          {data?.syncError && (
            <p className="error">
              {t("Could not load update history. Try again later.")}
            </p>
          )}
        </section>
      </div>
      <section className="panel catalog-panel deployment-history-panel">
        <div className="panel-heading">
          <h3>{t("Publication history")}</h3>
        </div>
        <div className="deployment-table">
          <table className="catalog">
            <thead>
              <tr>
                <th scope="col">{t("Date")}</th>
                <th scope="col">{t("Status")}</th>
                <th scope="col">{t("Duration")}</th>
                <th scope="col">{t("Published by")}</th>
                <th scope="col">{t("Note")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.deployments.map((d) => (
                <tr key={d.id}>
                  <td>{date(d.created_at, language)}</td>
                  <td>
                    <span
                      className={`badge ${d.status === "success" ? "done" : ["failed", "cancelled"].includes(d.status) ? "failed" : "queued"}`}
                    >
                      {t(statusLabel(d.status))}
                    </span>
                  </td>
                  <td>
                    {d.duration_ms === null
                      ? "—"
                      : `${Math.round(d.duration_ms / 1000)} s`}
                  </td>
                  <td>{d.created_by_name || "—"}</td>
                  <td className="deployment-history-note">
                    {d.message || "—"}
                  </td>
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
        aria-labelledby="deployment-dialog-title"
        {...dismiss}
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (modal === "config"
              ? save(hookUrl)
              : modal === "resolve"
                ? resolvePending()
                : publish());
          }}
        >
          <div className="modal-title">
            <h2 id="deployment-dialog-title">
              {modal === "config"
                ? t("Configure publishing")
                : modal === "resolve"
                  ? t("Resolve pending update")
                  : t("Publish update")}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Close")}
              disabled={busy}
              onClick={() => setModal(null)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="deployment-dialog-body">
            {modalError && (
              <p className="error" role="alert">
                {t(modalError)}
              </p>
            )}
            {modal === "resolve" ? (
              <label className="deployment-confirmation">
                <input
                  type="checkbox"
                  checked={stopped}
                  onChange={(e) => setStopped(e.target.checked)}
                />
                {t(
                  "I verified that this update stopped. Allow another publication.",
                )}
              </label>
            ) : modal === "config" ? (
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
                <ul className="deployment-publication-pages">
                  {data?.website.pages.map((p, i) => (
                    <li key={i}>
                      {p.title}
                      {p.issue ? ` · ${t(p.issue)}` : ""}
                    </li>
                  ))}
                </ul>
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
          </div>
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
            <button
              type="submit"
              className="primary"
              disabled={busy || (modal === "resolve" && !stopped)}
            >
              {busy
                ? t("Processing…")
                : modal === "config"
                  ? t("Save changes")
                  : modal === "resolve"
                    ? t("Confirm")
                    : t("Confirm and publish")}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
