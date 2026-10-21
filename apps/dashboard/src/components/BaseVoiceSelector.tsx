"use client";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "./api";
import { useI18n } from "../i18n/context";
import { pollWhileVisible } from "../lib/visible-polling";
import type { ReadingNarrationParameters } from "../lib/narration-parameters";
import {
  sampleTexts,
  type BaseVoice,
  type VoiceLocale,
} from "../lib/base-voices";

export function BaseVoiceSelector({
  locale,
  value,
  onChange,
  canGenerate = false,
  disabled = false,
  label,
  generation,
}: {
  locale: VoiceLocale;
  value: string;
  onChange: (id: string) => void;
  canGenerate?: boolean;
  disabled?: boolean;
  label?: string;
  generation?: {
    kind: "short" | "long" | "book" | "audio";
    role: "intro" | "outro" | "reading";
    readingParameters?: ReadingNarrationParameters | null;
  };
}) {
  const { t } = useI18n();
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
            pending.current = data.voices.some((voice) =>
              ["queued", "running"].includes(voice.status),
            );
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
  const generate = async () => {
    setSubmitting(true);
    setError("");
    try {
      await api(`base-voices/${value}/sample`, {
        method: "POST",
        body: JSON.stringify({ text, ...generation }),
      });
      pending.current = true;
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
  return (
    <div className="base-voice-picker">
      <label htmlFor={`${id}-voice`}>
        {t(label ?? (canGenerate ? "Default voice" : "Narration voice"))}
      </label>
      <select
        id={`${id}-voice`}
        value={value}
        disabled={disabled || loading || working}
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
          <label htmlFor={`${id}-text`}>{t("Example text")}</label>
          <textarea
            id={`${id}-text`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={disabled || loading || working}
          />
          <button
            type="button"
            disabled={disabled || working || !selected || !text.trim()}
            onClick={() => void generate()}
          >
            {t(
              working
                ? "Generating example…"
                : selected?.available
                  ? "Regenerate example"
                  : "Generate example",
            )}
          </button>
          <p className="muted">
            {t(
              generation?.role === "reading"
                ? "Examples use the reading settings shown above. Regenerate an example after changing them."
                : "Examples use the current narration settings from Administration tools. Regenerate an example after changing those settings.",
            )}
          </p>
        </>
      )}
      {working && (
        <p className="muted" role="status">
          {t(
            selected?.status === "queued"
              ? "Example waiting to be generated…"
              : "Generating example…",
          )}
        </p>
      )}
      {selected?.status === "failed" && (
        <p className="error" role="alert">
          {t("Could not generate the example. Try again.")}
        </p>
      )}
      {selected?.available ? (
        <>
          <label htmlFor={`${id}-audio`}>{t("Generated voice example")}</label>
          <audio
            id={`${id}-audio`}
            aria-label={t("Listen to the generated example")}
            controls
            preload="none"
            key={`${value}:${selected.generatedAt}`}
            src={`/api/base-voices/${value}/sample?revision=${encodeURIComponent(selected.generatedAt ?? "")}`}
          />
        </>
      ) : (
        !loading && (
          <p className="muted">
            {t("No example has been generated for this voice yet.")}
          </p>
        )
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}
