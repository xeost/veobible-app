"use client";
import { useModalDismiss } from "./useModalDismiss";
import { GenerationProgress } from "./GenerationProgress";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Mic,
  Film,
  ArrowUpRight,
  ListOrdered,
  RefreshCw,
  History,
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
  const { t, language } = useI18n();
  const [view, setView] = useState<"queue" | "history">("queue");
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
  const pending = state.items.filter((item) =>
    ["queued", "running"].includes(item.status),
  );
  const history = [...(state.history ?? [])].sort(
    (a, b) =>
      Date.parse(b.finishedAt ?? b.createdAt) -
      Date.parse(a.finishedAt ?? a.createdAt),
  );
  const visibleItems = view === "queue" ? pending : history;
  const dateFormatter = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <dialog
      ref={dialog}
      className="generation-queue-dialog"
      aria-labelledby="generation-queue-title"
      {...dismiss}
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
          data-tooltip={t("Refresh queue")}
          onClick={refresh}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div
        className="preview-source-tabs queue-view-tabs"
        role="tablist"
        aria-label={t("Generation queue")}
      >
        <button
          type="button"
          role="tab"
          id="generation-queue-tab"
          aria-controls="generation-queue-panel"
          aria-selected={view === "queue"}
          onClick={() => setView("queue")}
        >
          <ListOrdered size={16} /> {t("Queue")}
        </button>
        <button
          type="button"
          role="tab"
          id="generation-history-tab"
          aria-controls="generation-queue-panel"
          aria-selected={view === "history"}
          onClick={() => setView("history")}
        >
          <History size={16} /> {t("History")}
        </button>
      </div>
      {view === "queue" && pending.length > 0 && (
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
      <div
        className="generation-queue-list"
        id="generation-queue-panel"
        role="tabpanel"
        aria-labelledby={
          view === "queue" ? "generation-queue-tab" : "generation-history-tab"
        }
      >
        {view === "queue" && pending.length === 0 && (
          <p className="empty">{t("There are no pending generations.")}</p>
        )}
        {view === "history" && (
          <p className="muted queue-history-hint">
            {t(
              "Recent generations are kept until the generation service restarts.",
            )}
          </p>
        )}
        {view === "history" && history.length === 0 && (
          <p className="empty">
            {t(
              state.history === undefined && state.connected
                ? "Loading history…"
                : "There are no recent generations.",
            )}
          </p>
        )}
        {view === "queue" && pending.length > 0 && (
          <h3>{t("In progress and waiting")}</h3>
        )}
        {visibleItems.map((item) => (
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
                        : item.type === "outro"
                          ? "Closing narration"
                          : "Chapter introduction",
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
                {view === "history" && (
                  <time dateTime={item.finishedAt ?? item.createdAt}>
                    {dateFormatter.format(
                      new Date(item.finishedAt ?? item.createdAt),
                    )}
                  </time>
                )}
                {view === "queue" && (
                  <GenerationProgress
                    value={item.progress}
                    label={t("Progress")}
                  />
                )}
              </span>
              <ArrowUpRight size={18} aria-label={t("Open project")} />
            </Link>
          </div>
        ))}
      </div>
    </dialog>
  );
}
