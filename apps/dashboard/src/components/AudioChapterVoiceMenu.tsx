"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, WandSparkles } from "lucide-react";
import { useI18n } from "../i18n/context";

export function AudioChapterVoiceMenu({
  title,
  completed,
  total,
  disabled,
  generate,
}: {
  title: string;
  completed: number;
  total: number;
  disabled: boolean;
  generate: (regenerate: boolean) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    const menu = dropdown.current!;
    // The chapter card clips its contents. Use the top layer so the menu also
    // remains visible when the chapter is collapsed.
    menu.showPopover();
    const position = () => {
      const rect = trigger.current!.getBoundingClientRect();
      menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
      menu.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - menu.offsetHeight - 12))}px`;
    };
    position();
    firstItem.current?.focus();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const choose = (regenerate: boolean) => {
    setOpen(false);
    trigger.current?.focus();
    generate(regenerate);
  };
  return (
    <div
      ref={container}
      className="project-actions-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
        if (completed === 0 || disabled) return;
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          const items = Array.from(
            container.current!.querySelectorAll<HTMLButtonElement>(
              '[role="menuitem"]:not(:disabled)',
            ),
          );
          const index = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    items.length) %
                  items.length;
          items[next]?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="icon-button section-action-button audio-chapter-voice-trigger"
        disabled={disabled}
        aria-label={`${t("Generate all verse voices")} · ${title}`}
        data-tooltip={t("Generate all verse voices")}
        aria-haspopup={completed > 0 ? "menu" : undefined}
        aria-expanded={completed > 0 ? open : undefined}
        aria-controls={open ? id : undefined}
        onClick={() => (completed > 0 ? setOpen(!open) : generate(false))}
      >
        <WandSparkles size={17} aria-hidden="true" />
        {completed > 0 && <ChevronDown size={10} aria-hidden="true" />}
      </button>
      {open && (
        <div
          ref={dropdown}
          id={id}
          role="menu"
          popover="manual"
          className="project-actions-dropdown audio-chapter-voice-dropdown"
          aria-label={`${t("Generate all verse voices")} · ${title}`}
        >
          <button
            ref={firstItem}
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => choose(true)}
          >
            {t("Regenerate all verse voices")}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled || completed >= total}
            onClick={() => choose(false)}
          >
            {t("Generate remaining verse voices")}
          </button>
        </div>
      )}
    </div>
  );
}
