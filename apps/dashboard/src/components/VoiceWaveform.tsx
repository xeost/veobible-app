"use client";
import { useEffect, useRef, useState } from "react";
import { GripVertical, Pause, Play, RotateCcw } from "lucide-react";
import { useI18n } from "../i18n/context";

export type VoiceTrim = { startSeconds: number; endSeconds: number };
export function VoiceWaveform({
  src,
  trim,
  disabled,
  expanded,
  onTrim,
  audioRef,
  onPlaybackChange,
  onError,
}: {
  src: string;
  trim?: VoiceTrim;
  disabled: boolean;
  expanded: boolean;
  onTrim: (trim?: VoiceTrim) => void;
  audioRef: (audio: HTMLAudioElement | null) => void;
  onPlaybackChange: (playing: boolean) => void;
  onError: () => void;
}) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [waveError, setWaveError] = useState(false);
  const stopAt = useRef<number | null>(null);
  const end = Math.min(duration, trim?.endSeconds ?? duration);
  const start = Math.max(0, Math.min(trim?.startSeconds ?? 0, end - 0.02));
  const bounds = useRef({ start, end });
  bounds.current = { start, end };
  useEffect(() => {
    if (!expanded) return;
    let live = true;
    const controller = new AbortController();
    setWaveError(false);
    const decode = async () => {
      let context: AudioContext | undefined;
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error("Audio unavailable");
        context = new AudioContext();
        const buffer = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        const values = Array.from({ length: 160 }, (_, bar) => {
          let peak = 0;
          const from = Math.floor((bar * buffer.length) / 160);
          const to = Math.floor(((bar + 1) * buffer.length) / 160);
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const samples = buffer.getChannelData(channel);
            for (let i = from; i < to; i++)
              peak = Math.max(peak, Math.abs(samples[i]));
          }
          return peak;
        });
        const maximum = Math.max(...values, 0.01);
        if (live) {
          setDuration(buffer.duration);
          setPeaks(values.map((value) => value / maximum));
        }
      } catch {
        if (live) setWaveError(true);
      } finally {
        if (context) await context.close();
      }
    };
    void decode();
    return () => {
      live = false;
      controller.abort();
    };
  }, [src, expanded]);
  useEffect(() => {
    const player = audio.current;
    return () => player?.pause();
  }, []);
  useEffect(() => {
    if (!playing) return;
    let frame: number;
    const tick = () => {
      const player = audio.current;
      if (!player) return;
      setPlayhead(player.currentTime);
      const limit = Math.min(bounds.current.end, stopAt.current ?? Infinity);
      if (limit > 0 && player.currentTime >= limit) {
        player.pause();
        player.currentTime = limit;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  const play = (from = bounds.current.start, until = bounds.current.end) => {
    const player = audio.current;
    if (!player || until <= from) return;
    player.currentTime = from;
    stopAt.current = until;
    void player.play().catch(onError);
  };
  const move = (edge: "start" | "end", value: number) => {
    const current = bounds.current;
    const next =
      edge === "start"
        ? {
            startSeconds: Math.max(0, Math.min(value, current.end - 0.02)),
            endSeconds: current.end,
          }
        : {
            startSeconds: current.start,
            endSeconds: Math.max(
              current.start + 0.02,
              Math.min(duration, value),
            ),
          };
    bounds.current = { start: next.startSeconds, end: next.endSeconds };
    onTrim(next);
  };
  const handle = (edge: "start" | "end") => (
    <button
      type="button"
      className={`voice-trim-handle ${edge}`}
      disabled={disabled || !duration}
      style={{
        left: `${((edge === "start" ? start : end) / (duration || 1)) * 100}%`,
      }}
      role="slider"
      aria-label={t(edge === "start" ? "Voice trim start" : "Voice trim end")}
      aria-valuemin={edge === "start" ? 0 : start + 0.02}
      aria-valuemax={edge === "start" ? end - 0.02 : duration}
      aria-valuenow={edge === "start" ? start : end}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        audio.current?.pause();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (
          !event.currentTarget.hasPointerCapture(event.pointerId) ||
          !track.current
        )
          return;
        const box = track.current.getBoundingClientRect();
        move(edge, ((event.clientX - box.left) / box.width) * duration);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        const range = bounds.current;
        play(
          edge === "start" ? range.start : Math.max(range.start, range.end - 3),
          edge === "start" ? Math.min(range.end, range.start + 3) : range.end,
        );
      }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        move(
          edge,
          event.key === "Home"
            ? edge === "start"
              ? 0
              : start + 0.02
            : event.key === "End"
              ? edge === "start"
                ? end - 0.02
                : duration
              : bounds.current[edge] +
                (event.key === "ArrowLeft" ? -1 : 1) *
                  (event.shiftKey ? 0.1 : 0.01),
        );
      }}
    >
      <GripVertical size={14} aria-hidden="true" />
    </button>
  );
  return (
    <div className="voice-waveform">
      <audio
        ref={(player) => {
          audio.current = player;
          audioRef(player);
        }}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const player = event.currentTarget;
          if (!Number.isFinite(player.duration)) return;
          setDuration(player.duration);
          player.currentTime = Math.max(
            0,
            Math.min(trim?.startSeconds ?? 0, player.duration - 0.02),
          );
        }}
        onPlay={(event) => {
          const player = event.currentTarget;
          const range = bounds.current;
          if (
            range.end > 0 &&
            (player.currentTime < range.start ||
              player.currentTime >= range.end)
          )
            player.currentTime = range.start;
          setPlaying(true);
          onPlaybackChange(true);
        }}
        onTimeUpdate={(event) => {
          const limit = Math.min(
            bounds.current.end,
            stopAt.current ?? Infinity,
          );
          if (
            limit > 0 &&
            event.currentTarget.currentTime >= limit &&
            !event.currentTarget.paused
          )
            event.currentTarget.pause();
        }}
        onPause={() => {
          setPlaying(false);
          stopAt.current = null;
          onPlaybackChange(false);
        }}
        onEnded={() => {
          setPlaying(false);
          stopAt.current = null;
          onPlaybackChange(false);
        }}
        onError={onError}
      />
      <p className="muted">
        {t(
          "Select the voice fragment to use in previews and the final video. The original recording is kept.",
        )}
      </p>
      <div
        className="voice-waveform-track"
        ref={track}
        onClick={(event) => {
          if ((event.target as Element).closest("button") || !duration) return;
          const box = event.currentTarget.getBoundingClientRect();
          const time = ((event.clientX - box.left) / box.width) * duration;
          if (time >= start && time < end) play(time);
        }}
      >
        <svg
          viewBox="0 0 160 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {peaks.map((peak, i) => (
            <line
              key={i}
              x1={i + 0.5}
              x2={i + 0.5}
              y1={50 - peak * 43}
              y2={50 + peak * 43}
            />
          ))}
        </svg>
        <div
          className="voice-waveform-selection"
          style={{
            left: `${(start / (duration || 1)) * 100}%`,
            width: `${((end - start) / (duration || 1)) * 100}%`,
          }}
        />
        {handle("start")}
        {handle("end")}
        <div
          className="voice-waveform-playhead"
          style={{ left: `${(playhead / (duration || 1)) * 100}%` }}
        />
      </div>
      {waveError && (
        <p className="muted">
          {t(
            "Could not load the waveform. You can still adjust the start and end times.",
          )}
        </p>
      )}
      <div className="trim-fields">
        {(["start", "end"] as const).map((edge) => (
          <label key={edge}>
            {t(edge === "start" ? "Start" : "End")} ({t("seconds")})
            <input
              type="number"
              step="0.01"
              min={edge === "start" ? 0 : start + 0.02}
              max={edge === "start" ? end - 0.02 : duration}
              value={Number((edge === "start" ? start : end).toFixed(3))}
              disabled={disabled || !duration}
              onChange={(event) => move(edge, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
      <div className="verse-playback">
        <button
          type="button"
          disabled={!duration}
          onClick={() => (playing ? audio.current?.pause() : play())}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {t(playing ? "Pause" : "Listen to narration")}
        </button>
        <button
          type="button"
          disabled={disabled || !trim}
          onClick={() => {
            audio.current?.pause();
            onTrim(undefined);
          }}
        >
          <RotateCcw size={16} />
          {t("Use full recording")}
        </button>
      </div>
    </div>
  );
}
