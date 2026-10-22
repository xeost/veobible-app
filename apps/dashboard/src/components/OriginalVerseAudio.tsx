"use client";
import { useEffect, useRef, useState } from "react";
import type { OriginalAudioState } from "../../../../tools/video-project-api/src/original-audio-schema";
import { useI18n } from "../i18n/context";
import { pollWhileVisible } from "../lib/visible-polling";
import { api } from "./api";
import { VerseWaveform } from "./VerseWaveform";
import { GenerationProgress } from "./GenerationProgress";

export function OriginalVerseAudio({
  endpoint,
  chapter,
  reference,
  locale,
  checked,
  onChange,
}: {
  endpoint: string;
  chapter: number;
  reference: string;
  locale: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<OriginalAudioState | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!checked) return;
    let live = true,
      started = false,
      pending = true;
    const controller = new AbortController();
    setState(null);
    setError(false);
    const stop = pollWhileVisible(
      async () => {
        try {
          const next = await api<OriginalAudioState>(
            `${endpoint}/original?chapter=${chapter}`,
            {
              method: started ? "GET" : "POST",
              signal: controller.signal,
            },
          );
          if (!live) return;
          started = next.status !== "idle";
          pending =
            next.available &&
            ["queued", "running", "idle"].includes(next.status);
          setState(next);
          setError(!next.available || next.status === "failed");
        } catch {
          if (live) {
            setError(true);
            pending = false;
          }
        }
      },
      () => pending,
      1500,
    );
    return () => {
      live = false;
      stop();
      controller.abort();
    };
  }, [checked, endpoint, chapter, retry]);
  useEffect(() => {
    const element = root.current;
    return () => {
      element?.querySelectorAll("audio").forEach((audio) => audio.pause());
    };
  }, [checked, reference]);
  const cue = state?.cues?.find((cue) => cue.reference === reference);
  return (
    <div className="original-verse-audio" ref={root}>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {t("Listen to original audio")}
      </label>
      {checked &&
        (error || (state?.status === "done" && !cue) ? (
          <div role="alert">
            <p className="error">
              {t("Could not locate the original verse audio. Try again.")}
            </p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t("Try again")}
            </button>
          </div>
        ) : state?.status === "done" &&
          cue &&
          state.duration &&
          state.revision ? (
          <VerseWaveform
            key={reference}
            src={`/api/${endpoint}/original-media?chapter=${chapter}&revision=${encodeURIComponent(state.revision)}`}
            resourceKey={`original/${endpoint}/${chapter}/${state.revision}`}
            onPrepared={(_, success) => {
              if (!success) setError(true);
            }}
            cacheWaveform
            locale={locale}
            expanded
            sourceStart={0}
            sourceEnd={state.duration}
            sourceDuration={state.duration}
            timelineStart={0}
            volumeMultiplier={1}
            cues={[cue]}
            disabled
            readOnly
            playbackInToolbar
            compact
            showSourceContext={false}
            toolbarLeading={<strong>{t("Original recording")}</strong>}
            onExpand={() => {}}
            onTrim={() => {}}
            onShift={() => false}
            preservedReferences={[reference]}
          />
        ) : (
          <GenerationProgress
            value={state?.progress ?? 0}
            label={t(
              state?.status === "queued"
                ? "Waiting to locate original audio…"
                : "Locating original verse audio…",
            )}
          />
        ))}
    </div>
  );
}
