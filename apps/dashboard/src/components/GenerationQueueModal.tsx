"use client";
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
  const recent = state.items
    .filter((item) => ["done", "failed"].includes(item.status))
    .reverse();
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
          <p className="eyebrow">{t("PRODUCCIÓN DE VIDEOS")}</p>
          <h2 id="generation-queue-title">
            <ListOrdered size={22} />
            {t("Cola de generación")}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Cerrar")}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <p className="muted">
        {t(
          "Puedes seguir editando otros proyectos mientras se preparan las voces y los videos.",
        )}
      </p>
      <div className="generation-queue-summary">
        <span className={state.connected ? "dot green" : "dot"} />
        <span>
          {t(
            state.connected
              ? "Generación disponible"
              : "Generación no disponible",
          )}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Actualizar cola")}
          title={t("Actualizar cola")}
          onClick={refresh}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {!state.connected && (
        <p className="notice">
          {t(
            "No se pudo actualizar la cola. Inténtalo de nuevo en unos momentos.",
          )}
        </p>
      )}
      <div className="generation-queue-list">
        {pending.length === 0 && (
          <p className="empty">{t("No hay generaciones pendientes.")}</p>
        )}
        {pending.length > 0 && <h3>{t("En proceso y en espera")}</h3>}
        {[...pending, ...recent].map((item, index) => (
          <div key={item.id}>
            {index === pending.length && recent.length > 0 && (
              <h3>{t("Terminados recientemente")}</h3>
            )}
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
                      ? "Video final"
                      : item.type === "intro"
                        ? "Voz de introducción"
                        : "Voz de cierre",
                  )}{" "}
                  · {item.version.toUpperCase()}
                </small>
                <span>
                  {t(statusLabel(item.status))}
                  {item.status === "queued"
                    ? ` · ${t("Posición")} ${item.position}`
                    : item.status === "running" && item.type === "video"
                      ? ` · ${t(generationStage(item.stage, item.status))}`
                      : ""}
                </span>
              </span>
              <ArrowUpRight size={18} aria-label={t("Abrir proyecto")} />
            </Link>
          </div>
        ))}
      </div>
    </dialog>
  );
}
