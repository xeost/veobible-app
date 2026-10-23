"use client";
import type { Dispatch } from "react";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { useI18n } from "../i18n/context";
import {
  temporaryVerseText,
  type TemporaryVerseText,
} from "../lib/temporary-verse-text";

export function VersePronunciationEditor({
  reference,
  speech,
  dispatch,
  disabled,
}: {
  reference: string;
  speech: TemporaryVerseText;
  dispatch: Dispatch<Parameters<typeof temporaryVerseText>[1]>;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const editing = speech.draft !== null;
  const modified =
    speech.accepted !== speech.original ||
    (speech.draft !== null && speech.draft !== speech.original);
  return (
    <div className="verse-preview">
      <div className="audio-verse-text-heading">
        <span className="eyebrow">{reference}</span>
        <div className="audio-verse-text-actions">
          {modified && (
            <button
              type="button"
              className="icon-button"
              aria-label={t("Restore original verse text")}
              data-tooltip={t("Restore original verse text")}
              disabled={disabled}
              onClick={() => dispatch({ type: "restore" })}
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
          )}
          {editing && (
            <button
              type="button"
              className="icon-button"
              aria-label={t("Accept temporary text")}
              data-tooltip={t("Accept temporary text")}
              disabled={disabled || !speech.draft?.trim()}
              onClick={() => dispatch({ type: "accept" })}
            >
              <Check size={15} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={t(
              editing ? "Cancel text editing" : "Edit text for pronunciation",
            )}
            data-tooltip={t(
              editing ? "Cancel text editing" : "Edit text for pronunciation",
            )}
            disabled={disabled}
            onClick={() => dispatch({ type: editing ? "cancel" : "edit" })}
          >
            {editing ? (
              <X size={15} aria-hidden="true" />
            ) : (
              <Pencil size={15} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          aria-label={t("Text for this audio only")}
          value={speech.draft ?? ""}
          rows={4}
          autoFocus
          maxLength={5000}
          disabled={disabled}
          onChange={(event) =>
            dispatch({ type: "change", text: event.target.value })
          }
        />
      ) : (
        <p>{speech.accepted}</p>
      )}
    </div>
  );
}
