"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "../i18n/context";
import { useModalDismiss } from "./useModalDismiss";

/** Dashboard-styled confirmation with focus containment and safe default focus. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  close,
  busy = false,
  destructive = false,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  close: () => void;
  busy?: boolean;
  destructive?: boolean;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dismiss = useModalDismiss(() => {
    if (!busy) close();
  });
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    cancel.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      {...dismiss}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onConfirm();
        }}
      >
        <div className="generation-queue-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Close")}
            data-tooltip={t("Close")}
            onClick={close}
            disabled={busy}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div id={descriptionId} className="confirm-dialog-description">
          {children}
        </div>
        <div className="confirm-dialog-actions">
          <button ref={cancel} type="button" onClick={close} disabled={busy}>
            {t("Cancel")}
          </button>
          <button
            type="submit"
            className={destructive ? "danger" : "primary"}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
