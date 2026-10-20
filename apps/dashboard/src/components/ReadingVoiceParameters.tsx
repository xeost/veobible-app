"use client";
import { CircleHelp } from "lucide-react";
import { useId } from "react";
import { useI18n } from "../i18n/context";
import { narrationControlHelp } from "../lib/narration-control-help";
import {
  narrationControls,
  type NarrationParameters,
  type ReadingNarrationParameters,
} from "../lib/narration-parameters";

export function ReadingVoiceParameters({
  value,
  general,
  onChange,
  disabled,
}: {
  value: ReadingNarrationParameters | null;
  general: NarrationParameters;
  onChange: (value: ReadingNarrationParameters | null) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const prefix = useId();
  const initial = {
    exaggeration: general.exaggeration,
    cfg_weight: general.cfg_weight,
    temperature: general.temperature,
    repetition_penalty: general.repetition_penalty,
  };
  return (
    <fieldset disabled={disabled} className="reading-voice-parameters">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(event) => onChange(event.target.checked ? initial : null)}
        />
        {t("Use separate settings for passage reading")}
      </label>
      <p className="muted">
        {t(
          "When disabled, readings use the current settings from Administration tools. Changes apply to future reading generations in this format and language; saved recordings stay unchanged.",
        )}
      </p>
      {value && (
        <div className="narration-controls">
          {(
            Object.keys(narrationControls) as (keyof typeof narrationControls)[]
          ).map((parameter) => {
            const id = `${prefix}-${parameter}`;
            return (
              <div key={parameter}>
                <div className="narration-control-label">
                  <label htmlFor={id}>{parameter}</label>
                  <button
                    type="button"
                    className="narration-help"
                    aria-label={`${parameter}: ${t("Help")}`}
                    data-tooltip={t(narrationControlHelp[parameter])}
                    aria-describedby={`${id}-help`}
                  >
                    <CircleHelp size={15} aria-hidden="true" />
                  </button>
                  <span id={`${id}-help`} className="sr-only">
                    {t(narrationControlHelp[parameter])}
                  </span>
                  <output htmlFor={id}>{value[parameter].toFixed(2)}</output>
                </div>
                <input
                  id={id}
                  type="range"
                  {...narrationControls[parameter]}
                  value={value[parameter]}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      [parameter]: Number(event.target.value),
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
