"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Save, X } from "lucide-react";
import type { VideoProjectPage } from "../lib/pages-from-video-projects";
import { api } from "./api";
import { useI18n } from "../i18n/context";
import { useToast } from "./ToastProvider";
import { useModalDismiss } from "./useModalDismiss";
import { userMessage } from "../lib/presentation";
export function WebsitePageModal({
  page,
  close,
  saved,
}: {
  page: VideoProjectPage;
  close: () => void;
  saved: () => void;
}) {
  const { t } = useI18n();
  const notify = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const [description, setDescription] = useState(page.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dismiss = useModalDismiss(() => {
    if (!busy) close();
  });
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    textarea.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api("website/pages", {
        method: "POST",
        body: JSON.stringify({ videoProjectId: page.id, description }),
      });
      notify("Settings saved.");
      saved();
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog website-page-dialog"
      aria-labelledby={titleId}
      aria-busy={busy}
      {...dismiss}
    >
      <form
        className="website-page-dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void save();
        }}
      >
        <div className="generation-queue-heading website-page-dialog-heading">
          <div>
            <h2 id={titleId}>{t("Edit page")}</h2>
            <p className="muted">{page.title}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Close")}
            disabled={busy}
            onClick={close}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="website-page-dialog-body">
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <p className="muted">
            {page.locale.toUpperCase()} · {page.label}
          </p>
          <label>
            {t("Website description")}
            <textarea
              ref={textarea}
              rows={8}
              maxLength={10000}
              value={description}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <div className="website-page-dialog-footer">
          <button type="button" disabled={busy} onClick={close}>
            {t("Cancel")}
          </button>
          <button type="submit" className="primary" disabled={busy}>
            <Save size={16} aria-hidden="true" />
            {t(busy ? "Saving…" : "Save changes")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
