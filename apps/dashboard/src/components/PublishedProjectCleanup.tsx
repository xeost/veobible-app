"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import { useModalDismiss } from "./useModalDismiss";

type CleanupResult = {
  eligibleIds: number[];
  deletedIds: number[];
  skippedIds: number[];
  missingIds: number[];
  failedIds: number[];
};

export function PublishedProjectCleanup({
  kind,
  onDeleted,
}: {
  kind: "short" | "long";
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const countText = (text: string, count: number) =>
    t(text).replace("{count}", String(count));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CleanupResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => {
    if (!busy) setPreview(null);
  };
  const dismiss = useModalDismiss(close);
  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, [preview]);
  const prepare = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setPreview(
        await api<CleanupResult>("videos/cleanup-published", {
          method: "POST",
          body: JSON.stringify({ action: "preview", kind }),
        }),
      );
    } catch {
      setError(
        "Could not clean up published project files. Check that generation is available and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!preview?.eligibleIds.length) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<CleanupResult>("videos/cleanup-published", {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          kind,
          ids: preview.eligibleIds,
        }),
      });
      setMessage(
        countText(
          "Deleted {count} published project folders.",
          result.deletedIds.length,
        ) +
          (result.skippedIds.length
            ? ` ${countText("{count} projects with generation tasks will be kept.", result.skippedIds.length)}`
            : ""),
      );
      if (result.failedIds.length)
        setError("Some project folders could not be deleted. Try again.");
      setPreview(null);
      onDeleted();
    } catch {
      setError(
        "Could not clean up published project files. Check that generation is available and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="published-project-cleanup">
      <button
        type="button"
        className="button published-cleanup-button"
        disabled={busy}
        onClick={() => void prepare()}
        aria-label={t(
          kind === "short"
            ? "Clean up published short video files"
            : "Clean up published long video files",
        )}
        data-tooltip={t(
          "Delete local folders for all published projects of this format. Projects with generation tasks are kept.",
        )}
      >
        {busy ? (
          <LoaderCircle
            size={16}
            className="voice-spinner"
            aria-hidden="true"
          />
        ) : (
          <Trash2 size={16} aria-hidden="true" />
        )}
        {t("Clean up published files")}
      </button>
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
      {error && !preview && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {preview && (
        <dialog
          ref={dialog}
          className="modal published-cleanup-dialog"
          aria-labelledby={`cleanup-title-${kind}`}
          aria-describedby={`cleanup-description-${kind}`}
          onCancel={dismiss.onCancel}
          onPointerDown={dismiss.onPointerDown}
          onClick={dismiss.onClick}
        >
          <h2 id={`cleanup-title-${kind}`}>
            {t(
              kind === "short"
                ? "Clean up published short video files"
                : "Clean up published long video files",
            )}
          </h2>
          <p id={`cleanup-description-${kind}`}>
            {preview.eligibleIds.length
              ? countText(
                  "Delete {count} published project folders? This permanently removes their local videos, narrations, images and other generated files. Saved projects and publication marks are kept.",
                  preview.eligibleIds.length,
                )
              : t("No published project folders to delete.")}
          </p>
          {!!preview.skippedIds.length && (
            <p className="muted">
              {countText(
                "{count} projects with generation tasks will be kept.",
                preview.skippedIds.length,
              )}
            </p>
          )}
          {!!preview.failedIds.length && (
            <p className="error">
              {t("Some project folders could not be deleted. Try again.")}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="published-cleanup-actions">
            <button type="button" disabled={busy} onClick={close} autoFocus>
              {t("Cancel")}
            </button>
            {!!preview.eligibleIds.length && (
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy && (
                  <LoaderCircle
                    size={16}
                    className="voice-spinner"
                    aria-hidden="true"
                  />
                )}
                {t("Delete project folders")}
              </button>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
