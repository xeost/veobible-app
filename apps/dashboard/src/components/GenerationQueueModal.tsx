"use client";
import { GenerationProgress } from "./GenerationProgress";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  X,
  Mic,
  Film,
  ArrowUpRight,
  ListOrdered,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "../i18n/context";
import { generationStage, statusLabel } from "../lib/presentation";
import type { GenerationQueueState } from "../lib/generation-queue";
export function GenerationQueueModal({
  state,
  close,
  refresh,
}: {
  state: GenerationQueueState;
  close: () => void;
  refresh: () => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  const pending = state.items.filter((item) =>
    ["queued", "running"].includes(item.status),
  );
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog"
      aria-labelledby="generation-queue-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="generation-queue-heading">
        <div>
          <p className="eyebrow">{t("VIDEO PRODUCTION")}</p>
          <h2 id="generation-queue-title">
            <ListOrdered size={22} />
            {t("Generation queue")}
          </h2>
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
      <p className="muted">
        {t(
          "You can keep editing other projects while narration and videos are prepared.",
        )}
      </p>
      <div className="generation-queue-summary">
        <span className={state.connected ? "dot green" : "dot"} />
        <span>
          {state.connected
            ? t("Generation available")
            : t("Generation unavailable")}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Refresh queue")}
          title={t("Refresh queue")}
          onClick={refresh}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {pending.length > 0 && (
        <GenerationProgress
          value={state.summary?.progress ?? 0}
          label={t("Entire queue")}
        />
      )}
      {!state.connected && (
        <p className="notice">
          {t("Could not refresh the queue. Try again in a moment.")}
        </p>
      )}
      <div className="generation-queue-list">
        {pending.length === 0 && (
          <p className="empty">{t("There are no pending generations.")}</p>
        )}
        {pending.length > 0 && <h3>{t("In progress and waiting")}</h3>}
        {pending.map((item) => (
          <div key={item.id}>
            <Link
              href={item.href}
              onClick={close}
              className={`generation-queue-item ${item.status}`}
            >
              <span className="generation-queue-icon">
                {item.type === "video" ? <Film size={19} /> : <Mic size={19} />}
              </span>
              <span className="generation-queue-details">
                <strong>{item.title}</strong>
                <small>
                  {t(
                    item.type === "video"
                      ? "Final video"
                      : item.type === "intro"
                        ? "Introduction narration"
                        : "Closing narration",
                  )}{" "}
                  · {item.version.toUpperCase()}
                </small>
                <span>
                  {t(statusLabel(item.status))}
                  {item.status === "queued"
                    ? ` · ${t("Position")} ${item.position}`
                    : item.status === "running" && item.type === "video"
                      ? ` · ${t(generationStage(item.stage, item.status))}`
                      : ""}
                </span>
                <GenerationProgress
                  value={item.progress}
                  label={t("Progress")}
                />
              </span>
              <ArrowUpRight size={18} aria-label={t("Open project")} />
            </Link>
          </div>
        ))}
      </div>
    </dialog>
  );
}
