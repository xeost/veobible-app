"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Layers,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Player, type PlayerRef } from "@remotion/player";
import { useI18n } from "../i18n/context";
import { useModalDismiss } from "./useModalDismiss";
import { VisualElementAnimation } from "../../../../tools/video-project-api/src/remotion/SubscribeAnimation";
import {
  verticalPositions,
  socialVerticalPosition,
  elementMoments,
  type SubscribeElement,
  type VisualElement,
  type SocialVariant,
  type VideoLocale,
} from "../../../../tools/video-project-api/src/visual-elements";

const positionLabels = {
  top: "Top",
  "upper-intermediate": "Upper intermediate",
  "upper-third": "Upper third",
  center: "Center",
  "lower-third": "Lower third",
  "lower-intermediate": "Lower intermediate",
  bottom: "Bottom",
  custom: "Custom",
};
const momentLabels = {
  start: "Start",
  early: "Early third",
  middle: "Middle",
  late: "Final third",
  end: "Section end",
};
const elementTitle = (element: VisualElement) =>
  element.template === "social-button"
    ? "Social media button"
    : "YouTube subscribe button";

function ElementPicker({
  kind,
  element,
  locale,
  close,
  select,
}: {
  kind: string;
  element: SubscribeElement;
  locale: VideoLocale;
  close: () => void;
  select: (element: VisualElement) => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(true);
  const [template, setTemplate] =
    useState<VisualElement["template"]>("social-button");
  const [variant, setVariant] = useState<SocialVariant>("subscribe");
  const selected: VisualElement =
    template === "social-button"
      ? {
          template,
          verticalPosition: "lower-intermediate",
          moment: "early",
          hidden: false,
          references: element.references,
        }
      : element;
  const titleId = useId();
  const dismiss = useModalDismiss(close);
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
      className="generation-queue-dialog visual-element-dialog"
      aria-labelledby={titleId}
      {...dismiss}
    >
      <div className="generation-queue-heading">
        <h2 id={titleId}>{t("Choose a visual element")}</h2>
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
        {t("The animation is ready. You only need to personalize the content.")}
      </p>
      <div className="visual-picker-grid">
        <div>
          {(["social-button", "youtube-subscribe"] as const).map((option) => (
            <div
              key={option}
              className={`visual-template ${template === option ? "selected" : ""}`}
            >
              <button
                type="button"
                className="visual-template-choice"
                aria-pressed={template === option}
                onClick={() => {
                  setTemplate(option);
                  setPlaying(true);
                }}
              >
                <strong>
                  {t(
                    option === "social-button"
                      ? "Social media button"
                      : "YouTube subscribe button",
                  )}
                </strong>
                <span>
                  {t(
                    option === "social-button"
                      ? "Subscribe for YouTube, follow for other social networks. Text follows the video language."
                      : "An animated click turns the subscribe button into a subscribed button and activates the bell.",
                  )}
                </span>
              </button>
              {option === "social-button" && (
                <label className="visual-template-case">
                  {t("Preview case")}
                  <select
                    value={variant}
                    onChange={(event) => {
                      setVariant(event.target.value as SocialVariant);
                      setTemplate("social-button");
                      setPlaying(true);
                    }}
                  >
                    <option value="subscribe">
                      {t("Subscribe · YouTube")}
                    </option>
                    <option value="follow">
                      {t("Follow · Other social networks")}
                    </option>
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="visual-picker-preview">
          <div
            className={
              kind === "short" ? "visual-demo portrait" : "visual-demo"
            }
          >
            <Player
              key={`${template}-${variant}`}
              ref={player}
              component={VisualElementAnimation}
              inputProps={{
                element: selected,
                durationSeconds: 5,
                locale,
                variant,
              }}
              durationInFrames={150}
              compositionWidth={kind === "short" ? 1080 : 1920}
              compositionHeight={kind === "short" ? 1920 : 1080}
              fps={30}
              controls={false}
              clickToPlay={false}
              doubleClickToFullscreen={false}
              spaceKeyToPlayOrPause={false}
              autoPlay
              loop
              initiallyMuted
              style={{
                width:
                  kind === "short"
                    ? "min(100cqw, calc(100cqh * 9 / 16))"
                    : "min(100cqw, calc(100cqh * 16 / 9))",
                background: "#182331",
                borderRadius: 12,
              }}
            />
          </div>
          <div className="visual-demo-controls">
            <button
              type="button"
              onClick={() => {
                if (playing) player.current?.pause();
                else player.current?.play();
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
              {t(playing ? "Pause" : "Play")}
            </button>
            <button
              type="button"
              onClick={() => {
                player.current?.seekTo(0);
                player.current?.play();
                setPlaying(true);
              }}
            >
              <RotateCcw size={16} /> {t("Replay")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => select(selected)}
            >
              <Plus size={16} />
              {t("Use element")}
            </button>
          </div>
          <p className="muted">
            {t(
              template === "social-button"
                ? "Editor previews use subscribe. Generating this video creates subscribe and follow versions."
                : "Sample text. You can change it after adding the element.",
            )}
          </p>
        </div>
      </div>
    </dialog>
  );
}

export function SectionVisualElements({
  kind,
  locale,
  elements,
  references,
  disabled,
  previewDisabled,
  onPreview,
  onChange,
}: {
  kind: string;
  locale: string;
  elements: VisualElement[];
  references?: string[];
  disabled: boolean;
  previewDisabled: boolean;
  onPreview: () => void;
  onChange: (elements: VisualElement[]) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const sample: SubscribeElement = {
    template: "youtube-subscribe",
    startSeconds: 0,
    durationSeconds: 5,
    hidden: false,
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
    references,
  };
  const patch = (index: number, change: Partial<VisualElement>) =>
    onChange(
      elements.map((element, itemIndex) =>
        itemIndex === index
          ? ({
              ...element,
              ...change,
              references: references ?? element.references,
            } as VisualElement)
          : element,
      ),
    );
  return (
    <section className="section-visual-elements">
      <div className="visual-panel-header">
        <button
          type="button"
          className="visual-panel-heading"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <Layers size={18} />
          <strong>{t("Visual elements")}</strong>
          <span className="muted">{elements.length}</span>
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={previewDisabled}
          aria-label={t("Preview")}
          onClick={onPreview}
        >
          <Play size={17} />
        </button>
        <button
          type="button"
          className="icon-button visual-panel-toggle"
          aria-label={t("Visual elements")}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={18} className={open ? "expanded" : ""} />
        </button>
      </div>
      <div id={id} hidden={!open} className="visual-panel-body">
        <div className="visual-panel-toolbar">
          <p className="muted">
            {t("Add an animated social media button over this section.")}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPicker(true)}
          >
            <Plus size={16} />
            {t("Add element")}
          </button>
        </div>
        {!elements.length ? (
          <p className="visual-empty muted">
            {t("No visual elements in this section.")}
          </p>
        ) : (
          elements.map((element, index) => (
            <div className="visual-element-card" key={element.id ?? index}>
              <details open>
                <summary>
                  {index + 1}. {t(elementTitle(element))}
                </summary>
                <fieldset disabled={disabled} className="visual-element-fields">
                  {element.template === "social-button" ? (
                    <>
                      <label>
                        {t("Vertical position")}
                        <select
                          value={element.verticalPosition}
                          onChange={(event) => {
                            const verticalPosition = event.target
                              .value as typeof element.verticalPosition;
                            patch(index, {
                              verticalPosition,
                              ...(verticalPosition === "custom"
                                ? {
                                    customVerticalPosition:
                                      element.customVerticalPosition ??
                                      Number(
                                        (
                                          socialVerticalPosition(element) * 100
                                        ).toFixed(2),
                                      ),
                                  }
                                : {}),
                            });
                          }}
                        >
                          {verticalPositions.map((position) => (
                            <option key={position} value={position}>
                              {t(positionLabels[position])}
                            </option>
                          ))}
                        </select>
                      </label>
                      {element.verticalPosition === "custom" && (
                        <>
                          <label>
                            {t("Height from top (%)")}
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={element.customVerticalPosition ?? 50}
                              onChange={(event) => {
                                const value = event.target.valueAsNumber;
                                if (Number.isFinite(value))
                                  patch(index, {
                                    customVerticalPosition: Math.min(
                                      100,
                                      Math.max(0, value),
                                    ),
                                  });
                              }}
                            />
                            <span className="muted">
                              {t(
                                "0% is the top and 100% is the bottom. The value sets the center of the element.",
                              )}
                            </span>
                          </label>
                          <label>
                            {t("Position from left (%)")}
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={element.customHorizontalPosition ?? 50}
                              onChange={(event) => {
                                const value = event.target.valueAsNumber;
                                if (Number.isFinite(value))
                                  patch(index, {
                                    customHorizontalPosition: Math.min(
                                      100,
                                      Math.max(0, value),
                                    ),
                                  });
                              }}
                            />
                            <span className="muted">
                              {t(
                                "0% is the left and 100% is the right. The value sets the center of the element.",
                              )}
                            </span>
                          </label>
                        </>
                      )}
                      <label>
                        {t("Appearance in this section")}
                        <select
                          value={element.moment}
                          onChange={(event) =>
                            patch(index, {
                              moment: event.target
                                .value as typeof element.moment,
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
                    </>
                  ) : (
                    <>
                      <label>
                        {t("Button text")}
                        <input
                          maxLength={40}
                          value={element.label}
                          onBlur={() => {
                            if (!element.label.trim())
                              patch(index, { label: sample.label });
                          }}
                          onChange={(event) =>
                            patch(index, { label: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        {t("Subscribed text")}
                        <input
                          maxLength={40}
                          value={element.subscribedLabel}
                          onBlur={() => {
                            if (!element.subscribedLabel.trim())
                              patch(index, {
                                subscribedLabel: sample.subscribedLabel,
                              });
                          }}
                          onChange={(event) =>
                            patch(index, {
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
                              patch(index, {
                                startSeconds: Math.min(
                                  86400,
                                  Math.max(0, value),
                                ),
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
                              patch(index, {
                                durationSeconds: Math.min(
                                  60,
                                  Math.max(1, value),
                                ),
                              });
                          }}
                        />
                      </label>
                    </>
                  )}
                </fieldset>
                <p className="muted">
                  {t(
                    "The animation ends with the section. Save changes to include it in the video.",
                  )}
                </p>
              </details>
              <div className="visual-element-actions">
                <button
                  type="button"
                  className="icon-button"
                  disabled={disabled}
                  aria-label={t(
                    element.hidden ? "Show element" : "Hide element",
                  )}
                  onClick={() => patch(index, { hidden: !element.hidden })}
                >
                  {element.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={disabled}
                  aria-label={t("Remove element")}
                  onClick={() =>
                    onChange(
                      elements.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {picker && (
        <ElementPicker
          kind={kind}
          element={sample}
          locale={locale as VideoLocale}
          close={() => setPicker(false)}
          select={(selected) => {
            onChange([...elements, { ...selected, id: crypto.randomUUID() }]);
            setPicker(false);
          }}
        />
      )}
    </section>
  );
}
