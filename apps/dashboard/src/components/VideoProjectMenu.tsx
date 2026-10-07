"use client";
import { useEffect, useRef, useState } from "react";
import {
  MoreVertical,
  RefreshCw,
  Settings,
  FolderSync,
  LoaderCircle,
} from "lucide-react";
import { useI18n } from "../i18n/context";
export function VideoProjectMenu({
  onSettings,
  onSync,
  onSyncExisting,
  syncingExisting,
}: {
  onSettings: () => void;
  onSync: () => void;
  onSyncExisting: () => void;
  syncingExisting: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    item = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    item.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      ref={container}
      className="project-actions-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="icon-button"
        aria-label={t("Project options")}
        data-tooltip={t("Project options")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "video-project-options" : undefined}
        onClick={() => setOpen(!open)}
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div
          role="menu"
          id="video-project-options"
          className="project-actions-dropdown"
          aria-label={t("Project options")}
        >
          <button
            ref={item}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
          >
            <Settings size={16} aria-hidden="true" />
            {t("Settings")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSync();
            }}
          >
            <RefreshCw size={16} />
            {t("Sync project presets")}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={syncingExisting}
            onClick={() => {
              setOpen(false);
              onSyncExisting();
            }}
          >
            {syncingExisting ? (
              <LoaderCircle size={16} />
            ) : (
              <FolderSync size={16} />
            )}
            {syncingExisting
              ? t("Syncing existing projects…")
              : t("Sync existing projects")}
          </button>
        </div>
      )}
    </div>
  );
}
