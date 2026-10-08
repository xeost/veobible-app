"use client";
import { useModalDismiss } from "./useModalDismiss";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "../i18n/context";
import type { VideoPreviewView } from "./VideoProjectPreview";
import type { VideoKind } from "./video-project";

export function VideoProjectPreviewModal({
  kind,
  view,
  onViewChange,
  close,
  children,
}: {
  kind: VideoKind;
  view: VideoPreviewView;
  onViewChange: (view: VideoPreviewView) => void;
  close: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const dismiss = useModalDismiss(close);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`generation-queue-dialog video-preview-dialog ${kind}`}
      aria-labelledby="video-preview-title"
      {...dismiss}
    >
      <div className="generation-queue-heading">
        <h2 id="video-preview-title">{t("Video preview")}</h2>
        <div
          className="preview-source-tabs"
          role="tablist"
          aria-label={t("Preview source")}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "composition"
                : event.key === "End"
                  ? "rendered"
                  : view === "composition"
                    ? "rendered"
                    : "composition";
            onViewChange(next);
            event.currentTarget
              .querySelector<HTMLButtonElement>(`#preview-tab-${next}`)
              ?.focus();
          }}
        >
          {(["composition", "rendered"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              id={`preview-tab-${option}`}
              aria-selected={view === option}
              aria-controls="preview-view-panel"
              tabIndex={view === option ? 0 : -1}
              onClick={() => onViewChange(option)}
            >
              {t(option === "composition" ? "Composition" : "Final video")}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Close")}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <div
        className="preview-modal-content"
        role="tabpanel"
        id="preview-view-panel"
        aria-labelledby={`preview-tab-${view}`}
      >
        {children}
      </div>
    </dialog>
  );
}
