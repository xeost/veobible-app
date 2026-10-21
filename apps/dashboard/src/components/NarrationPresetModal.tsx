"use client";
import { useEffect, useRef, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { useI18n } from "../i18n/context";
import { useModalDismiss } from "./useModalDismiss";
import {
  narrationControls,
  narrationParametersSchema,
} from "../lib/narration-parameters";
import { narrationControlHelp } from "../lib/narration-control-help";
import type { CustomNarrationPreset } from "../lib/narration-style-presets";

const controlLabels = {
  exaggeration: "Emotional intensity",
  cfg_weight: "Guidance and pacing",
  temperature: "Voice variation",
  repetition_penalty: "Repetition prevention",
} as const;
export function NarrationPresetModal({
  initial,
  readOnly,
  language,
  close,
  apply,
}: {
  initial: CustomNarrationPreset;
  readOnly: boolean;
  language: string;
  close: () => void;
  apply: (preset: CustomNarrationPreset) => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useModalDismiss(close);
  const [draft, setDraft] = useState(initial);
  const values = narrationParametersSchema.parse(draft.settings);
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
      className="generation-queue-dialog narration-preset-dialog"
      aria-labelledby="narration-preset-title"
      {...dismiss}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!readOnly && draft.name.trim())
            apply({ ...draft, name: draft.name.trim() });
        }}
      >
        <div className="generation-queue-heading">
          <div>
            <p className="eyebrow">{t(language)}</p>
            <h2 id="narration-preset-title">
              {t(readOnly ? initial.name : "Configure narration preset")}
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
            readOnly
              ? "This built-in preset is read-only. Add a preset to create your own style."
              : "Adjust this style for this Bible language. Apply it, then save changes to keep the preset.",
          )}
        </p>
        {!readOnly && (
          <label>
            {t("Preset name")}
            <input
              autoFocus
              required
              maxLength={80}
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
        )}
        <div className="narration-controls">
          {(
            Object.keys(narrationControls) as (keyof typeof narrationControls)[]
          ).map((parameter) => {
            const id = `preset-${parameter}`;
            return (
              <div key={parameter}>
                <div className="narration-control-label">
                  <label htmlFor={id}>{t(controlLabels[parameter])}</label>
                  <button
                    type="button"
                    className="narration-help"
                    aria-label={`${t(controlLabels[parameter])}: ${t("Help")}`}
                    data-tooltip={`${parameter}: ${t(narrationControlHelp[parameter])}`}
                    aria-describedby={`${id}-help`}
                  >
                    <CircleHelp size={15} aria-hidden="true" />
                  </button>
                  <span id={`${id}-help`} className="sr-only">
                    {`${parameter}: ${t(narrationControlHelp[parameter])}`}
                  </span>
                  <output htmlFor={id}>{values[parameter].toFixed(2)}</output>
                </div>
                <input
                  id={id}
                  type="range"
                  disabled={readOnly}
                  {...narrationControls[parameter]}
                  value={values[parameter]}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      settings: {
                        ...draft.settings,
                        [parameter]: Number(event.target.value),
                      },
                    })
                  }
                />
              </div>
            );
          })}
        </div>
        <dl className="narration-fixed-settings">
          <div>
            <dt>{t("Minimum sampling threshold")}</dt>
            <dd>{values.min_p}</dd>
          </div>
          <div>
            <dt>{t("Sampling probability limit")}</dt>
            <dd>{values.top_p}</dd>
          </div>
        </dl>
        <div className="modal-footer">
          <button type="button" onClick={close}>
            {t(readOnly ? "Close" : "Cancel")}
          </button>
          {!readOnly && (
            <button
              className="primary"
              type="submit"
              disabled={!draft.name.trim()}
            >
              {t("Apply preset")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
