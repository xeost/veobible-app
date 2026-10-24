"use client";
import { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  MousePointerClick,
  Save,
  Trash2,
} from "lucide-react";
import { useI18n } from "../i18n/context";
import type { VisualShortcut } from "../lib/visual-shortcuts";
import type { VisualElement } from "../../../../tools/video-project-api/src/visual-elements";
import type { VisualShortcutsState } from "./useVisualShortcuts";
import { VisualElementFields } from "./VisualElementFields";

export function VisualShortcutEditor({
  shortcut,
  shortcuts,
  locale,
  disabled,
}: {
  shortcut: VisualShortcut;
  shortcuts: VisualShortcutsState;
  locale: string;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(shortcut.name);
  const [element, setElement] = useState<VisualElement>(shortcut.element);
  const savedValue = JSON.stringify(shortcut);
  useEffect(() => {
    setName(shortcut.name);
    setElement(shortcut.element);
  }, [savedValue]);
  const changed =
    name !== shortcut.name ||
    JSON.stringify(element) !== JSON.stringify(shortcut.element);
  const locked =
    disabled || shortcuts.busy || shortcuts.loading || Boolean(shortcuts.error);
  const index = shortcuts.items.findIndex((item) => item.id === shortcut.id);
  return (
    <div className="visual-shortcut-item">
      <details className="visual-shortcut-card">
        <summary>
          <MousePointerClick size={16} aria-hidden="true" />
          {shortcut.name}
        </summary>
        <label className="visual-shortcut-name">
          {t("Shortcut name")}
          <input
            value={name}
            maxLength={80}
            disabled={locked}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <VisualElementFields
          element={element}
          locale={locale}
          disabled={locked}
          onChange={(change) =>
            setElement(
              (current) => ({ ...current, ...change }) as VisualElement,
            )
          }
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={element.hidden}
            disabled={locked}
            onChange={(event) =>
              setElement((current) => ({
                ...current,
                hidden: event.target.checked,
              }))
            }
          />
          {t("Add hidden")}
        </label>
        <div className="visual-shortcut-actions">
          <button
            type="button"
            disabled={locked || !changed || !name.trim()}
            onClick={() => void shortcuts.save(name, element, shortcut.id)}
          >
            <Save size={16} />
            {t("Save shortcut")}
          </button>
          <button
            type="button"
            disabled={locked || !changed}
            onClick={() => {
              setName(shortcut.name);
              setElement(shortcut.element);
            }}
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => void shortcuts.remove(shortcut.id)}
          >
            <Trash2 size={16} />
            {t("Remove shortcut")}
          </button>
        </div>
      </details>
      <div
        className="visual-shortcut-order"
        role="group"
        aria-label={t("Reorder shortcut: {name}").replace(
          "{name}",
          shortcut.name,
        )}
      >
        <button
          type="button"
          className="icon-button"
          disabled={locked || index <= 0}
          aria-label={t("Move up: {name}").replace("{name}", shortcut.name)}
          data-tooltip={t("Move up")}
          onClick={() => void shortcuts.move(shortcut.id, "up")}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={locked || index >= shortcuts.items.length - 1}
          aria-label={t("Move down: {name}").replace("{name}", shortcut.name)}
          data-tooltip={t("Move down")}
          onClick={() => void shortcuts.move(shortcut.id, "down")}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
