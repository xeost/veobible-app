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
          <h2 id="sync-projects-title">{t("Sync project presets")}</h2>
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
        <p className="muted">
          {t(
            "Suggested passages without a project for this version will be added. Your existing projects will keep all their changes.",
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
          <p className="empty">{t("Loading versions…")}</p>
        ) : versions.length ? (
          <fieldset disabled={busy} className="voice-settings-fields">
            <label>
              {t("Bible version")}
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
              "Add a Bible version before creating a project. If you do not have access, ask the administrator for help.",
            )}
          </p>
        )}
        {result && (
          <p className="success" role="status">
            {result.added
              ? `${t("New projects added:")} ${result.added}.`
              : t("There are no new projects to add.")}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t("Close")}
          </button>
          <button className="primary" disabled={loading || busy || !version}>
            {busy ? <LoaderCircle size={16} /> : <RefreshCw size={16} />}{" "}
            {busy ? t("Syncing projects…") : t("Sync project presets")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
