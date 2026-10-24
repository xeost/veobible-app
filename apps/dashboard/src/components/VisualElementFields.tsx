"use client";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/context";
import {
  verticalPositions,
  horizontalPositions,
  replacesDomain,
  elementMoments,
  type VisualElement,
} from "../../../../tools/video-project-api/src/visual-elements";

const positionLabels = {
  top: "Top",
  "upper-third": "Upper third",
  center: "Center",
  "lower-third": "Lower third",
  bottom: "Bottom",
};
const horizontalPositionLabels = {
  left: "Left",
  "left-third": "Left third",
  center: "Center",
  "right-third": "Right third",
  right: "Right",
};
const momentLabels = {
  start: "Start",
  early: "Early third",
  middle: "Middle",
  late: "Final third",
  end: "Section end",
};
function OffsetInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      min={-100}
      max={100}
      step="0.1"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        const next = event.target.valueAsNumber;
        if (Number.isFinite(next))
          onChange(Math.max(-100, Math.min(100, next)));
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}

export function VisualElementFields({
  element,
  locale,
  disabled,
  onChange,
}: {
  element: VisualElement;
  locale: string;
  disabled: boolean;
  onChange: (change: Partial<VisualElement>) => void;
}) {
  const { t } = useI18n();
  const patch = onChange;
  const sample = {
    label:
      locale === "es"
        ? "Suscribirse"
        : locale === "pt"
          ? "Inscrever-se"
          : "Subscribe",
    subscribedLabel:
      locale === "es"
        ? "Suscrito"
        : locale === "pt"
          ? "Inscrito"
          : "Subscribed",
  };
  return (
    <fieldset disabled={disabled} className="visual-element-fields">
      {element.template === "social-button" ? (
        <>
          <label>
            {t("Appearance in this section")}
            <select
              value={element.moment}
              onChange={(event) =>
                patch({
                  moment: event.target.value as typeof element.moment,
                })
              }
            >
              {elementMoments.map((moment) => (
                <option key={moment} value={moment}>
                  {t(momentLabels[moment])}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Position")}
            <select
              value={replacesDomain(element) ? "replace-domain" : "coordinates"}
              onChange={(event) =>
                patch({
                  positionMode: event.target.value as
                    "coordinates" | "replace-domain",
                  verticalPosition: verticalPositions.includes(
                    element.verticalPosition as (typeof verticalPositions)[number],
                  )
                    ? element.verticalPosition
                    : "lower-third",
                })
              }
            >
              <option value="coordinates">
                {t("Configure vertical and horizontal")}
              </option>
              <option value="replace-domain">{t("Replace domain")}</option>
            </select>
          </label>
          {!replacesDomain(element) && (
            <>
              <label>
                {t("Vertical position")}
                <select
                  value={
                    element.verticalPosition === "upper-intermediate"
                      ? "upper-third"
                      : element.verticalPosition === "lower-intermediate"
                        ? "lower-third"
                        : element.verticalPosition === "custom"
                          ? "center"
                          : element.verticalPosition
                  }
                  onChange={(event) =>
                    patch({
                      verticalPosition: event.target
                        .value as typeof element.verticalPosition,
                    })
                  }
                >
                  {verticalPositions.map((position) => (
                    <option key={position} value={position}>
                      {t(positionLabels[position])}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Horizontal position")}
                <select
                  value={element.horizontalPosition ?? "center"}
                  onChange={(event) =>
                    patch({
                      horizontalPosition: event.target
                        .value as typeof element.horizontalPosition,
                    })
                  }
                >
                  {horizontalPositions.map((position) => (
                    <option key={position} value={position}>
                      {t(horizontalPositionLabels[position])}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="visual-element-offset-toggle">
            <input
              type="checkbox"
              checked={element.offsetsEnabled ?? false}
              onChange={(event) =>
                patch({
                  offsetsEnabled: event.target.checked,
                })
              }
            />
            {t("Configure offsets")}
          </label>
          {element.offsetsEnabled && (
            <>
              <label>
                {t("Vertical offset (%)")}
                <OffsetInput
                  value={element.verticalOffset ?? 0}
                  onChange={(value) => patch({ verticalOffset: value })}
                />
                <span className="muted">
                  {t("Positive values move down; negative values move up.")}
                </span>
              </label>
              <label>
                {t("Horizontal offset (%)")}
                <OffsetInput
                  value={element.horizontalOffset ?? 0}
                  onChange={(value) => patch({ horizontalOffset: value })}
                />
                <span className="muted">
                  {t("Positive values move right; negative values move left.")}
                </span>
              </label>
            </>
          )}
        </>
      ) : (
        <>
          <label>
            {t("Button text")}
            <input
              maxLength={40}
              value={element.label}
              onBlur={() => {
                if (!element.label.trim()) patch({ label: sample.label });
              }}
              onChange={(event) => patch({ label: event.target.value })}
            />
          </label>
          <label>
            {t("Subscribed text")}
            <input
              maxLength={40}
              value={element.subscribedLabel}
              onBlur={() => {
                if (!element.subscribedLabel.trim())
                  patch({
                    subscribedLabel: sample.subscribedLabel,
                  });
              }}
              onChange={(event) =>
                patch({
                  subscribedLabel: event.target.value,
                })
              }
            />
          </label>
          <label>
            {t("Start in section (seconds)")}
            <input
              type="number"
              min={0}
              max={86400}
              step="0.1"
              value={element.startSeconds}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value))
                  patch({
                    startSeconds: Math.min(86400, Math.max(0, value)),
                  });
              }}
            />
          </label>
          <label>
            {t("Animation duration (seconds)")}
            <input
              type="number"
              min={1}
              max={60}
              step="0.1"
              value={element.durationSeconds}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value))
                  patch({
                    durationSeconds: Math.min(60, Math.max(1, value)),
                  });
              }}
            />
          </label>
        </>
      )}
    </fieldset>
  );
}
