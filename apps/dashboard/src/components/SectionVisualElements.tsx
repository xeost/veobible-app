"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  Clapperboard,
  Eye,
  EyeOff,
  Layers,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  X,
  BookmarkPlus,
  MousePointerClick,
} from "lucide-react";
import { Player, type PlayerRef } from "@remotion/player";
import { VisualElementFields } from "./VisualElementFields";
import { VisualShortcutEditor } from "./VisualShortcutEditor";
import type { VisualShortcutsState } from "./useVisualShortcuts";
import { elementFromShortcut } from "../lib/visual-shortcuts";
import { useI18n } from "../i18n/context";
import { useModalDismiss } from "./useModalDismiss";
import { VisualElementAnimation } from "../../../../tools/video-project-api/src/remotion/SubscribeAnimation";
import {
  type SubscribeElement,
  type VisualElement,
  type SocialVariant,
  type VideoLocale,
} from "../../../../tools/video-project-api/src/visual-elements";

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
          verticalPosition: "lower-third",
          positionMode: "coordinates",
          horizontalPosition: "center",
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
  shortcuts,
}: {
  kind: string;
  locale: string;
  elements: VisualElement[];
  references?: string[];
  disabled: boolean;
  previewDisabled: boolean;
  onPreview: () => void;
  onChange: (elements: VisualElement[]) => void;
  shortcuts: VisualShortcutsState;
}) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
        </button>
        {shortcuts.items.length > 0 && (
          <>
            <div
              className="visual-shortcut-buttons"
              role="group"
              aria-label={t("Visual element shortcuts")}
            >
              {shortcuts.items.map((shortcut) => {
                const label = t("Add: {name}").replace("{name}", shortcut.name);
                return (
                  <button
                    key={shortcut.id}
                    type="button"
                    className="icon-button visual-shortcut-button"
                    aria-label={label}
                    data-tooltip={label}
                    disabled={disabled || shortcuts.loading}
                    onClick={() =>
                      onChange([
                        ...elements,
                        elementFromShortcut(shortcut, references),
                      ])
                    }
                  >
                    <MousePointerClick size={17} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <span className="visual-shortcut-divider" aria-hidden="true" />
          </>
        )}
        <span
          className="muted visual-element-count"
          aria-label={t("Visual elements: {count}").replace(
            "{count}",
            String(elements.length),
          )}
        >
          {elements.length}
        </span>
        <button
          type="button"
          className="icon-button"
          disabled={previewDisabled}
          aria-label={t("Preview")}
          onClick={onPreview}
        >
          <Clapperboard size={16} aria-hidden="true" />
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
              <details>
                <summary>
                  {index + 1}. {t(elementTitle(element))}
                </summary>
                <VisualElementFields
                  element={element}
                  locale={locale}
                  disabled={disabled}
                  onChange={(change) => patch(index, change)}
                />
                <p className="muted">
                  {t(
                    "The animation ends with the section. Save changes to include it in the video.",
                  )}
                </p>
                <button
                  type="button"
                  disabled={
                    disabled ||
                    shortcuts.loading ||
                    shortcuts.busy ||
                    Boolean(shortcuts.error) ||
                    shortcuts.items.length >= 32
                  }
                  onClick={async () => {
                    const saved = await shortcuts.save(
                      `${t(elementTitle(element))} ${shortcuts.items.length + 1}`,
                      element,
                    );
                    if (saved) setShortcutsOpen(true);
                  }}
                >
                  <BookmarkPlus size={16} />
                  {t("Save as shortcut")}
                </button>
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
        <details
          className="visual-shortcuts-panel"
          open={shortcutsOpen}
          onToggle={(event) => setShortcutsOpen(event.currentTarget.open)}
        >
          <summary>
            {t("Visual element shortcuts")}{" "}
            <span className="muted">{shortcuts.items.length}</span>
          </summary>
          <p className="muted">
            {t(
              "Shortcuts are shared by all projects of this format. Editing a shortcut only changes the elements you add next.",
            )}
          </p>
          {shortcuts.loading && (
            <p role="status" className="muted">
              {t("Loading shortcuts…")}
            </p>
          )}
          {shortcuts.error && (
            <p role="alert" className="error">
              {t(shortcuts.error)}
            </p>
          )}
          {!shortcuts.loading &&
            !shortcuts.error &&
            !shortcuts.items.length && (
              <p className="muted">
                {t(
                  "No shortcuts yet. Configure an element and choose Save as shortcut.",
                )}
              </p>
            )}
          {shortcuts.items.length >= 32 && (
            <p className="muted">
              {t(
                "You can save up to 32 shortcuts per format. Remove a shortcut before adding another.",
              )}
            </p>
          )}
          {shortcuts.items.map((shortcut) => (
            <VisualShortcutEditor
              key={shortcut.id}
              shortcut={shortcut}
              shortcuts={shortcuts}
              locale={locale}
              disabled={disabled}
            />
          ))}
        </details>
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
