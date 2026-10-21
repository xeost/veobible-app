"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Play, Pause, WandSparkles, RotateCcw } from "lucide-react";
import { api } from "./api";
import { useI18n } from "../i18n/context";
import { queueChangedEvent } from "../lib/generation-queue";
import { pollWhileVisible } from "../lib/visible-polling";
import type { VoiceSampleSettings } from "../lib/voice-sample-settings";
import {
  sampleTexts,
  type BaseVoice,
  type VoiceLocale,
} from "../lib/base-voices";

export function BaseVoiceSelector({
  locale,
  value,
  onChange,
  disabled = false,
  label,
  narrationSettings,
}: {
  locale: VoiceLocale;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
  narrationSettings?: VoiceSampleSettings;
}) {
  const { t } = useI18n();
  const canGenerate = Boolean(narrationSettings);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const id = useId();
  const [voices, setVoices] = useState<BaseVoice[]>([]);
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
            const data = await api<{ voices: BaseVoice[] }>(
              `base-voices?locale=${locale}`,
            );
            if (!live) return;
            const wasPending = pending.current;
            pending.current = data.voices.some((voice) =>
              ["queued", "running"].includes(voice.status),
            );
            if (wasPending && !pending.current)
              window.dispatchEvent(new Event(queueChangedEvent));
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
  const selected = voices.find((voice) => voice.id === value);
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
  }, [value, locale, selected?.generatedAt]);
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
      await api(`base-voices/${value}/sample`, {
        method: "POST",
        body: JSON.stringify({ text, narrationSettings }),
      });
      pending.current = true;
      window.dispatchEvent(new Event(queueChangedEvent));
      setVoices((current) =>
        current.map((voice) =>
          voice.id === value
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
          {!voices.some((voice) => voice.id === value) && (
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
          key={`${value}:${selected.generatedAt}`}
          src={`/api/base-voices/${value}/sample?revision=${encodeURIComponent(selected.generatedAt ?? "")}`}
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
