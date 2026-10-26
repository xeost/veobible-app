"use client";
import { Bookmark } from "lucide-react";
import type { AudioCatalogRow } from "../lib/audio-listing";
import type { CurrentProjects } from "../lib/current-video-projects";
import { audioProjectVersionKey } from "../lib/current-audio-projects";
import { useI18n } from "../i18n/context";
import { useToast } from "./ToastProvider";
import { userMessage } from "../lib/presentation";

export function AudioProjectMarker({
  row,
  marks,
  toggle,
}: {
  row: AudioCatalogRow;
  marks: CurrentProjects;
  toggle: (row: AudioCatalogRow) => void;
}) {
  const { t } = useI18n();
  const notify = useToast();
  const ids = marks[audioProjectVersionKey(row)] ?? [];
  const active = ids.includes(row.id);
  const full = !active && ids.length >= 2;
  const label = active
    ? "Remove current project mark"
    : "Mark as current project";
  return (
    <button
      type="button"
      className={`icon-button current-project-marker${active ? " active" : ""}`}
      aria-pressed={active}
      aria-label={`${t(label)}: ${row.title}`}
      disabled={full}
      data-tooltip={t(
        full
          ? "Two projects are already marked for this Bible version. Remove one mark to choose another."
          : label,
      )}
      onClick={(event) => {
        event.stopPropagation();
        try {
          toggle(row);
        } catch (cause) {
          notify(userMessage(cause), "error");
        }
      }}
    >
      <Bookmark size={16} aria-hidden="true" />
    </button>
  );
}
