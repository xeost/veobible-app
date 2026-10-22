"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Play, Pause, WandSparkles, RotateCcw, CircleHelp } from "lucide-react";
import { api } from "./api";
import { useI18n } from "../i18n/context";
import { queueChangedEvent } from "../lib/generation-queue";
import { pollWhileVisible } from "../lib/visible-polling";
import {
  narrationPresets,
  narrationParametersSchema,
} from "../lib/narration-parameters";
import {
  builtInNarrationLabels,
  narrationPresetLibrarySchema,
  type NarrationPresetLibrary,
} from "../lib/narration-style-presets";
import type { NarrationPresetSelection } from "../lib/voice-style-presets";
import type { VoiceSampleSettings } from "../lib/voice-sample-settings";
import {
  sampleTexts,
  type BaseVoice,
  type VoiceLocale,
} from "../lib/base-voices";

export function BaseVoiceSelector({
  locale,
  value,
  defaultVoice,
  onChange,
  disabled = false,
  label,
  narrationSettings,
  preset,
  onPresetChange,
}: {
  locale: VoiceLocale;
  value: string;
  defaultVoice?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
  narrationSettings?: VoiceSampleSettings;
  preset?: NarrationPresetSelection;
  onPresetChange?: (preset: NarrationPresetSelection | undefined) => void;
}) {
  const { t } = useI18n();
  const canGenerate = Boolean(narrationSettings);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const id = useId();
  const [voices, setVoices] = useState<BaseVoice[]>([]);
  const [presets, setPresets] = useState<NarrationPresetLibrary | null>(null);
  const [text, setText] = useState(sampleTexts[locale]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    return (() => {
      const stop = pollWhileVisible(
        async () => {
          try {
            const data = await api<{
              voices: BaseVoice[];
              presets: NarrationPresetLibrary;
            }>(`base-voices?locale=${locale}`);
            if (!live) return;
            const wasPending = pending.current;
            pending.current = data.voices.some((voice) =>
              ["queued", "running"].includes(voice.status),
            );
            if (wasPending && !pending.current)
              window.dispatchEvent(new Event(queueChangedEvent));
            setPresets(narrationPresetLibrarySchema.parse(data.presets));
            setVoices(data.voices);
            setError("");
          } catch (cause) {
            if (live) setError("Could not load voices. Try again.");
            throw cause;
          } finally {
            if (live) setLoading(false);
          }
        },
        () => pending.current,
        2500,
      );
      return () => {
        live = false;
        stop();
      };
    })();
  }, [locale]);
  const effectiveValue = value || defaultVoice || "";
  const selected = voices.find((voice) => voice.id === effectiveValue);
  useEffect(() => {
    setText(selected?.text || sampleTexts[locale]);
  }, [selected?.id, selected?.text, locale]);
  const working =
    submitting ||
    Boolean(selected && ["queued", "running"].includes(selected.status));
  useEffect(() => {
    const player = audio.current;
    setPlaying(false);
    return () => {
      player?.pause();
    };
  }, [effectiveValue, locale, selected?.generatedAt]);
  useEffect(() => {
    if (working) {
      audio.current?.pause();
      setPlaying(false);
    }
  }, [working]);
  const togglePlayback = async () => {
    if (working) return;
    const player = audio.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    setError("");
    try {
      await player.play();
    } catch {
      setError("Could not play the example. Try again.");
    }
  };
  const generate = async () => {
    if (!narrationSettings || working) return;
    audio.current?.pause();
    setPlaying(false);
    setSubmitting(true);
    setError("");
    try {
      await api(`base-voices/${effectiveValue}/sample`, {
        method: "POST",
        body: JSON.stringify({ text, narrationSettings }),
      });
      pending.current = true;
      window.dispatchEvent(new Event(queueChangedEvent));
      setVoices((current) =>
        current.map((voice) =>
          voice.id === effectiveValue
            ? { ...voice, status: "queued", progress: 0 }
            : voice,
        ),
      );
    } catch {
      setError("Could not generate the example. Try again.");
    } finally {
      setSubmitting(false);
    }
  };
  const playbackButton = (
    <button
      type="button"
      className="icon-button base-voice-play"
      aria-label={t(
        playing ? "Pause voice example" : "Listen to the generated example",
      )}
      data-tooltip={t(
        !selected?.available
          ? "No example has been generated for this voice yet."
          : playing
            ? "Pause voice example"
            : "Listen to the generated example",
      )}
      disabled={loading || working || !selected?.available}
      onClick={() => void togglePlayback()}
    >
      {playing ? (
        <Pause size={18} aria-hidden="true" />
      ) : (
        <Play size={18} aria-hidden="true" />
      )}
    </button>
  );
  return (
    <div className="base-voice-picker">
      <label htmlFor={`${id}-voice`}>
        {t(label ?? (canGenerate ? "Default voice" : "Narration voice"))}
      </label>
      <div className="base-voice-select-row">
        <select
          id={`${id}-voice`}
          value={value}
          disabled={disabled || loading || (canGenerate && working)}
          onChange={(event) => onChange(event.target.value)}
        >
          {defaultVoice && (
            <option value="">
              {t("Default ({voice})").replace(
                "{voice}",
                t("Voice {number}").replace(
                  "{number}",
                  defaultVoice.split("-")[1],
                ),
              )}
            </option>
          )}
          {value && !voices.some((voice) => voice.id === value) && (
            <option value={value}>
              {t("Voice {number}").replace("{number}", value.split("-")[1])}
            </option>
          )}
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {t("Voice {number}").replace("{number}", voice.id.split("-")[1])}
            </option>
          ))}
        </select>
        {!canGenerate && playbackButton}
      </div>
      {!canGenerate && onPresetChange && (
        <>
          <div className="voice-style-picker-label">
            <label htmlFor={`${id}-preset`}>{t("Narration style")}</label>
            <button
              type="button"
              className="narration-help"
              aria-label={`${t("Narration style")}: ${t("Help")}`}
              data-tooltip={t(
                "Sets the expression and pacing of generated narration. The voice example may have been generated with a different style.",
              )}
              aria-describedby={`${id}-preset-help`}
            >
              <CircleHelp size={15} aria-hidden="true" />
            </button>
            <span id={`${id}-preset-help`} className="sr-only">
              {t(
                "Sets the expression and pacing of generated narration. The voice example may have been generated with a different style.",
              )}
            </span>
          </div>
          <select
            id={`${id}-preset`}
            value={preset?.id ?? ""}
            aria-describedby={`${id}-preset-help`}
            disabled={disabled || loading || !presets}
            onChange={(event) => {
              const selected = event.target.value;
              if (!selected) {
                onPresetChange(undefined);
                return;
              }
              if (Object.hasOwn(narrationPresets, selected)) {
                const key = selected as keyof typeof narrationPresets;
                onPresetChange({
                  id: key,
                  name: builtInNarrationLabels[key],
                  settings: { ...narrationPresets[key] },
                });
              } else {
                const item = presets?.[locale].items.find(
                  (item) => item.id === selected,
                );
                if (item)
                  onPresetChange({
                    ...item,
                    settings: narrationParametersSchema.parse(item.settings),
                  });
              }
            }}
          >
            <option value="">{t("Use default narration style")}</option>
            {Object.entries(builtInNarrationLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
            {presets?.[locale].items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id === "saved-narration" &&
                item.name === "Saved narration"
                  ? t("Saved narration")
                  : item.name}
              </option>
            ))}
            {preset &&
              !Object.hasOwn(narrationPresets, preset.id) &&
              !presets?.[locale].items.some(
                (item) => item.id === preset.id,
              ) && (
                <option value={preset.id}>
                  {preset.name === "Saved narration"
                    ? t("Saved narration")
                    : preset.name}
                </option>
              )}
          </select>
        </>
      )}
      {loading && (
        <p className="muted" role="status">
          {t("Loading voices…")}
        </p>
      )}
      {!loading && !selected && !error && (
        <p className="notice">
          {t(
            "This voice is currently unavailable. Choose another voice or contact your administrator.",
          )}
        </p>
      )}
      {canGenerate && (
        <>
          <div className="base-voice-text-heading">
            <label htmlFor={`${id}-text`}>{t("Example text")}</label>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Restore default example text")}
              data-tooltip={t("Restore default example text")}
              disabled={
                disabled || loading || working || text === sampleTexts[locale]
              }
              onClick={() => setText(sampleTexts[locale])}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
          <textarea
            id={`${id}-text`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={disabled || loading || working}
          />
          <div className="base-voice-sample-actions">
            <button
              type="button"
              disabled={disabled || working || !selected || !text.trim()}
              onClick={() => void generate()}
            >
              <WandSparkles size={17} aria-hidden="true" />
              {t(
                working
                  ? "Generating example…"
                  : selected?.available
                    ? "Regenerate example"
                    : "Generate example",
              )}
            </button>
            {playbackButton}
          </div>
          <p className="muted">
            {t(
              "Examples use the model and narration preset currently selected above, including unsaved changes. Regenerate an example after changing them.",
            )}
          </p>
        </>
      )}
      {canGenerate && working && (
        <p className="muted" role="status">
          {t(
            selected?.status === "queued"
              ? "Example waiting to be generated…"
              : "Generating example…",
          )}
        </p>
      )}
      {canGenerate && selected?.status === "failed" && (
        <p className="error" role="alert">
          {t("Could not generate the example. Try again.")}
        </p>
      )}
      {selected?.available && (
        <audio
          ref={audio}
          id={`${id}-audio`}
          aria-label={t("Listen to the generated example")}
          hidden
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setPlaying(false);
            setError("Could not play the example. Try again.");
          }}
          preload="none"
          key={`${effectiveValue}:${selected.generatedAt}`}
          src={`/api/base-voices/${effectiveValue}/sample?revision=${encodeURIComponent(selected.generatedAt ?? "")}`}
        />
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}
