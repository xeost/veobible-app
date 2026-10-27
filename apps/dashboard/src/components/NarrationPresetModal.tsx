"use client";
import { useEffect, useRef, useState } from "react";
import { CircleHelp, X, Trash2 } from "lucide-react";
import { useI18n } from "../i18n/context";
import { useModalDismiss } from "./useModalDismiss";
import {
  type NarrationParameters,
  narrationControls,
  narrationParametersSchema,
} from "../lib/narration-parameters";
import { narrationControlHelp } from "../lib/narration-control-help";
import {
  isQwenNarrationModel,
  isCosyNarrationModel,
  narrationModelOptions,
} from "../lib/narration-models";
import {
  type CosyParameters,
  cosyControls,
  cosyDefaults,
  qwenControls,
  qwenDefaults,
  qwenParametersSchema,
} from "../../../../tools/video-project-api/src/narration-model-settings";
import { builtInNarrationLabels } from "../lib/narration-style-presets";
import type { CustomNarrationPreset } from "../lib/narration-style-presets";

const controlLabels = {
  exaggeration: "Emotional intensity",
  cfg_weight: "Guidance and pacing",
  temperature: "Voice variation",
  repetition_penalty: "Repetition prevention",
} as const;
export function NarrationPresetModal({
  initial,
  model,
  readOnly,
  language,
  close,
  apply,
  onDelete,
}: {
  initial: CustomNarrationPreset;
  model: string;
  readOnly: boolean;
  language: string;
  close: () => void;
  apply: (preset: CustomNarrationPreset) => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useModalDismiss(close);
  const [draft, setDraft] = useState(initial);
  const modelLabel =
    Object.values(narrationModelOptions)
      .flat()
      .find((option) => option.value === model)?.label ?? model;
  const builtIn = Object.hasOwn(builtInNarrationLabels, initial.id);
  const qwen = isQwenNarrationModel(model);
  const cosy = isCosyNarrationModel(model);
  const bundle = (
    cosy ? draft.settings : narrationParametersSchema.parse(draft.settings)
  ) as NarrationParameters;
  const selected = bundle.modelSettings?.[model];
  const cosyValues = { ...cosyDefaults, ...selected } as CosyParameters;
  const values: Record<string, number> = cosy
    ? Object.fromEntries(
        Object.entries(cosyValues).filter(
          (entry): entry is [string, number] => typeof entry[1] === "number",
        ),
      )
    : qwen
      ? qwenParametersSchema.parse(selected ?? qwenDefaults)
      : narrationParametersSchema.omit({ modelSettings: true }).parse(
          selected ?? {
            exaggeration: bundle.exaggeration,
            cfg_weight: bundle.cfg_weight,
            temperature: bundle.temperature,
            min_p: bundle.min_p,
            top_p: bundle.top_p,
            repetition_penalty: bundle.repetition_penalty,
          },
        );
  const controls: Record<string, { min: number; max: number; step: number }> =
    cosy ? cosyControls : qwen ? qwenControls : narrationControls;
  const labels: Record<string, string> = {
    ...controlLabels,
    speed: "Speaking speed",
    win_size: "Repetition window",
    tau_r: "Repetition threshold",
    seed: "Random seed",
    top_p: "Sampling probability limit",
    top_k: "Sampling candidates",
    max_new_tokens: "Speech length limit",
  };
  const help: Record<string, string> = cosy
    ? {
        speed: "Adjusts the playback pace of the generated speech.",
        top_p:
          "Limits the range of likely speech choices. Lower values make generation more selective.",
        top_k: "Limits how many speech choices are considered at each step.",
        win_size: "How many recent speech choices are checked for repetition.",
        tau_r: "Repetition threshold before choosing another speech sound.",
        seed: "Use the same seed to make comparisons more consistent.",
      }
    : qwen
      ? {
          temperature:
            "Higher values produce more varied speech; lower values are more predictable.",
          top_p:
            "Limits the range of likely speech choices. Lower values make generation more selective.",
          top_k: "Limits how many speech choices are considered at each step.",
          repetition_penalty:
            "Higher values discourage repeated sounds. Adjust independently for each voice model.",
          max_new_tokens:
            "Limits the length of each generated fragment. Raise this if a complete verse reaches the limit.",
        }
      : narrationControlHelp;
  function setValue(parameter: string, value: number | string) {
    const effective = { ...(cosy ? cosyValues : values), [parameter]: value };
    setDraft({
      ...draft,
      settings: {
        ...draft.settings,
        modelSettings: { ...bundle.modelSettings, [model]: effective },
      },
    });
  }
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
          if (
            !readOnly &&
            draft.name.trim() &&
            narrationParametersSchema.safeParse(draft.settings).success
          )
            apply({ ...draft, name: draft.name.trim() });
        }}
      >
        <div className="generation-queue-heading">
          <div>
            <h2 id="narration-preset-title">
              {t(readOnly ? initial.name : "Configure narration preset")}
            </h2>
            <p className="eyebrow">
              {t(language)} · {t(modelLabel)}
            </p>
            {initial.name && (
              <p className="muted">
                {builtIn ? t(initial.name) : initial.name}
              </p>
            )}
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
        {readOnly && (
          <p className="muted">
            {t(
              "This built-in preset is read-only. Add a preset to create your own style.",
            )}
          </p>
        )}
        {!readOnly && !builtIn && (
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
        {cosy && (
          <div className="cosy-narration-options">
            <label htmlFor="cosy-cloning-mode">
              {t("Voice cloning mode")} (mode)
            </label>
            <select
              id="cosy-cloning-mode"
              disabled={readOnly}
              value={cosyValues.mode}
              onChange={(event) => setValue("mode", event.target.value)}
            >
              <option value="cross_lingual">
                {t("Clone without transcript")}
              </option>
              <option value="zero_shot">{t("Clone with transcript")}</option>
              <option value="instruct">
                {t("Clone with narration instructions")}
              </option>
            </select>
            {cosyValues.mode === "zero_shot" && (
              <p className="muted">
                {t(
                  "This mode requires an exact transcript of the base recording.",
                )}
              </p>
            )}
            {cosyValues.mode === "instruct" && (
              <label>
                {t("Narration instructions")} (instructions)
                <textarea
                  required
                  rows={3}
                  maxLength={500}
                  disabled={readOnly}
                  value={cosyValues.instructions}
                  onChange={(event) =>
                    setValue("instructions", event.target.value)
                  }
                />
              </label>
            )}
          </div>
        )}
        <div className="narration-controls">
          {Object.keys(controls)
            .filter((parameter) => parameter !== "seed")
            .map((parameter) => {
              const id = `preset-${parameter}`;
              return (
                <div key={parameter}>
                  <div className="narration-control-label">
                    <label htmlFor={id}>
                      {t(labels[parameter])} ({parameter})
                    </label>
                    <button
                      type="button"
                      className="narration-help"
                      aria-label={`${t(labels[parameter])}: ${t("Help")}`}
                      data-tooltip={t(help[parameter])}
                      aria-describedby={`${id}-help`}
                    >
                      <CircleHelp size={15} aria-hidden="true" />
                    </button>
                    <span id={`${id}-help`} className="sr-only">
                      {t(help[parameter])}
                    </span>
                    <output htmlFor={id}>
                      {values[parameter].toFixed(
                        controls[parameter].step === 1 ? 0 : 2,
                      )}
                    </output>
                  </div>
                  <input
                    id={id}
                    type="range"
                    disabled={readOnly}
                    {...controls[parameter]}
                    value={values[parameter]}
                    onChange={(event) =>
                      setValue(parameter, Number(event.target.value))
                    }
                  />
                </div>
              );
            })}
        </div>
        {cosy && (
          <label>
            {t("Random seed")} (seed)
            <input
              type="number"
              min={0}
              max={2147483647}
              step={1}
              disabled={readOnly}
              value={cosyValues.seed}
              onChange={(event) => setValue("seed", Number(event.target.value))}
            />
          </label>
        )}
        {!qwen && !cosy && (
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
        )}
        <div className="modal-footer narration-preset-footer">
          {!readOnly && onDelete && (
            <button
              type="button"
              className="narration-preset-delete"
              onClick={onDelete}
            >
              <Trash2 size={16} aria-hidden="true" />
              {t("Delete preset")}
            </button>
          )}
          <div>
            <button type="button" onClick={close}>
              {t(readOnly ? "Close" : "Cancel")}
            </button>
            {!readOnly && (
              <button
                className="primary"
                type="submit"
                disabled={
                  !draft.name.trim() ||
                  !narrationParametersSchema.safeParse(draft.settings).success
                }
              >
                {t("Apply preset")}
              </button>
            )}
          </div>
        </div>
      </form>
    </dialog>
  );
}
