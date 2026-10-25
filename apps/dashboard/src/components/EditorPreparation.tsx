"use client";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { useI18n } from "../i18n/context";

export type PreparationTask = {
  label: string;
  status: "Waiting" | "In progress" | "Completed" | "Could not complete";
};

export function EditorPreparation({
  description,
  tasks,
  completed = 0,
  total = 0,
}: {
  description: string;
  tasks: PreparationTask[];
  completed?: number;
  total?: number;
}) {
  const { t } = useI18n();
  return (
    <div
      className="editor-preparation-overlay"
      role="status"
      aria-live="polite"
    >
      <div className="editor-preparation-message">
        <LoaderCircle size={32} className="voice-spinner" aria-hidden="true" />
        <h2>{t("Preparing the editor…")}</h2>
        <p className="muted">{t(description)}</p>
        <ul className="editor-preparation-tasks">
          {tasks.map((task) => (
            <li key={task.label}>
              {task.status === "In progress" ? (
                <LoaderCircle
                  size={16}
                  className="voice-spinner"
                  aria-hidden="true"
                />
              ) : task.status === "Completed" ? (
                <CircleCheck size={16} aria-hidden="true" />
              ) : (
                <span aria-hidden="true">
                  {task.status === "Waiting" ? "·" : "!"}
                </span>
              )}
              <span>{t(task.label)}</span>
              <span className="muted">{t(task.status)}</span>
            </li>
          ))}
        </ul>
        {total > 0 && (
          <>
            <progress
              max={total}
              value={completed}
              aria-label={t("Preparing audio")}
            />
            <p className="muted">
              {t("{completed} of {total} audio tracks prepared")
                .replace("{completed}", String(completed))
                .replace("{total}", String(total))}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
