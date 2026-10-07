"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, AudioLines, ZoomIn, ZoomOut } from "lucide-react";
import { useI18n } from "../i18n/context";
import {
  type VerseCue,
  trimBounds,
  trimCue,
  trimPreviewRange,
  waveformSeekRange,
  waveformWindow,
} from "../lib/video-timing";
export function VerseWaveform({
  src,
  sourceStart,
  sourceEnd,
  timelineStart,
  cues,
  disabled,
  onTrim,
}: {
  src: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  cues: VerseCue[];
  disabled: boolean;
  onTrim: (reference: string, edge: "start" | "end", value: number) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [focus, setFocus] = useState(
    cues[0] ?? {
      start: timelineStart,
      end: timelineStart + sourceEnd - sourceStart,
    },
  );
  const [waveError, setWaveError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [hasPlayhead, setHasPlayhead] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [revision, setRevision] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const stopAt = useRef(sourceEnd);
  const playbackRequest = useRef(0);
  const draggedCue = useRef<VerseCue | null>(null);
  const latest = useRef(cues);
  latest.current = cues;
  const duration = sourceEnd - sourceStart;
  const index = Math.min(selected, Math.max(0, cues.length - 1));
  const cue = cues[index];
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    let context: AudioContext | undefined;
    setBuffer(null);
    setWaveError(false);
    const decode = async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error("Audio unavailable");
        context = new AudioContext();
        const buffer = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        if (live) setBuffer(buffer);
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
      audio.current?.pause();
    };
  }, [src, sourceStart, duration, revision]);
  const window = waveformWindow(focus, timelineStart, timelineStart + duration);
  const visibleDuration = window.end - window.start;
  useEffect(() => {
    if (latest.current[index]) setFocus(latest.current[index]);
    audio.current?.pause();
    playbackRequest.current++;
    setHasPlayhead(false);
    setZoom(1);
    if (scroll.current) scroll.current.scrollLeft = 0;
  }, [cue?.reference, src, sourceStart, sourceEnd]);
  const peaks = useMemo(() => {
    if (!buffer || visibleDuration <= 0) return [];
    const channels = Array.from(
      { length: buffer.numberOfChannels },
      (_, channel) => buffer.getChannelData(channel),
    );
    const start = Math.max(
      0,
      Math.floor(
        (sourceStart + window.start - timelineStart) * buffer.sampleRate,
      ),
    );
    const length = Math.ceil(visibleDuration * buffer.sampleRate);
    const bars = 1000;
    const values = Array.from({ length: bars }, (_, bar) => {
      const from = start + Math.floor((bar * length) / bars);
      const to = Math.min(
        buffer.length,
        start + Math.floor(((bar + 1) * length) / bars),
      );
      let peak = 0;
      for (const channel of channels)
        for (let i = from; i < to; i++)
          peak = Math.max(peak, Math.abs(channel[i] ?? 0));
      return peak;
    });
    const max = Math.max(...values, 0.01);
    return values.map((value) => value / max);
  }, [buffer, sourceStart, timelineStart, window.start, visibleDuration]);
  useEffect(() => {
    if (!playing) return;
    let frame: number;
    const tick = () => {
      if (!audio.current) return;
      setPlayhead(audio.current.currentTime);
      if (audio.current.currentTime >= stopAt.current) {
        audio.current.pause();
        if (audio.current.currentTime > stopAt.current)
          audio.current.currentTime = stopAt.current;
        setPlayhead(stopAt.current);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  const percent = (time: number) =>
    ((time - window.start) / visibleDuration) * 100;
  const playRange = async (range: { start: number; end: number }) => {
    const player = audio.current;
    if (!player || range.end <= range.start) return;
    const request = ++playbackRequest.current;
    player.pause();
    player.currentTime = sourceStart + range.start - timelineStart;
    stopAt.current = sourceStart + range.end - timelineStart;
    setPlayhead(player.currentTime);
    setHasPlayhead(true);
    try {
      await player.play();
    } catch (error) {
      if (
        request === playbackRequest.current &&
        !(error instanceof DOMException && error.name === "AbortError")
      )
        setWaveError(true);
    }
  };
  const move = (edge: "start" | "end", time: number, recenter = false) => {
    audio.current?.pause();
    playbackRequest.current++;
    const value = trimCue(
      latest.current,
      index,
      edge,
      time,
      timelineStart,
      timelineStart + duration,
    );
    const updated = { ...latest.current[index], [edge]: value };
    draggedCue.current = updated;
    onTrim(cue.reference, edge, value);
    if (recenter) {
      setFocus(updated);
      void playRange(trimPreviewRange(updated, edge));
    }
  };
  const preview = async () => {
    if (!audio.current || !cue) return;
    if (playing) {
      playbackRequest.current++;
      audio.current.pause();
      return;
    }
    await playRange(cue);
  };
  const handle = (edge: "start" | "end") => {
    const bounds = trimBounds(cues, index, window.start, window.end);
    return (
      <button
        type="button"
        className={`trim-handle ${edge}`}
        style={{ left: `${percent(cue[edge])}%` }}
        disabled={disabled}
        role="slider"
        aria-label={`${t(edge === "start" ? "Inicio" : "Fin")} · ${cue.reference}`}
        aria-valuemin={bounds[`${edge}Min`]}
        aria-valuemax={bounds[`${edge}Max`]}
        aria-valuenow={cue[edge]}
        aria-valuetext={`${(cue[edge] - timelineStart).toFixed(2)} ${t("segundos")}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.preventDefault();
          draggedCue.current = null;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const box = track.current!.getBoundingClientRect();
          move(
            edge,
            window.start +
              Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) *
                visibleDuration,
          );
        }}
        onPointerUp={(event) => {
          const updated = draggedCue.current ?? latest.current[index];
          setFocus(updated);
          if (draggedCue.current)
            void playRange(trimPreviewRange(updated, edge));
          draggedCue.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          draggedCue.current = null;
          setFocus(latest.current[index]);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.01;
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            move(
              edge,
              event.key === "Home"
                ? bounds[`${edge}Min`]
                : event.key === "End"
                  ? bounds[`${edge}Max`]
                  : cue[edge] + (event.key === "ArrowLeft" ? -step : step),
              true,
            );
          }
        }}
      >
        <span />
      </button>
    );
  };
  if (!cue)
    return (
      <p className="muted">
        {t("There are no verses to synchronize in this section.")}
      </p>
    );
  return (
    <div className="verse-sync">
      <div className="verse-picker">
        {cues.map((verse, i) => (
          <button
            type="button"
            key={verse.reference}
            className={index === i ? "active" : ""}
            aria-pressed={index === i}
            onClick={() => {
              audio.current?.pause();
              setSelected(i);
            }}
          >
            <span>{verse.reference}</span>
            <small>
              {(verse.start - timelineStart).toFixed(2)}–
              {(verse.end - timelineStart).toFixed(2)} s
            </small>
          </button>
        ))}
      </div>
      <div className="sync-workspace">
        <div className="sync-heading">
          <AudioLines size={18} />
          <strong>{t("Synchronize text and audio")}</strong>
          <div>
            <button
              type="button"
              aria-label={t("Zoom out")}
              disabled={zoom === 1}
              onClick={() => setZoom(Math.max(1, zoom - 1))}
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              aria-label={t("Zoom in")}
              disabled={zoom === 6}
              onClick={() => setZoom(Math.min(6, zoom + 1))}
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
        <p className="muted">
          {t(
            "Release an edge to hear 3 seconds from that side. Click inside the fragment to listen from that point to the end. Use the arrow keys for precise adjustments.",
          )}
        </p>
        <div className="waveform-scroll" ref={scroll}>
          <div
            className="waveform-track"
            ref={track}
            style={{ width: `${zoom * 100}%` }}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const time =
                window.start +
                ((event.clientX - box.left) / box.width) * visibleDuration;
              const range = waveformSeekRange(latest.current[index], time);
              if (range) void playRange(range);
            }}
          >
            <svg
              viewBox="0 0 1000 120"
              preserveAspectRatio="none"
              className="waveform-bars"
              aria-label={t("Audio waveform")}
              role="img"
            >
              {peaks.map((peak, i) => (
                <rect
                  key={i}
                  x={i}
                  y={60 - peak * 52}
                  width={0.7}
                  height={Math.max(1, peak * 104)}
                  rx={0.3}
                />
              ))}
            </svg>
            {!peaks.length && (
              <span className="waveform-status">
                {t(
                  waveError
                    ? "Could not load the waveform. You can adjust timing and try again."
                    : "Loading waveform…",
                )}
              </span>
            )}
            <div
              className="waveform-region selected"
              style={{
                left: `${percent(cue.start)}%`,
                width: `${((cue.end - cue.start) / visibleDuration) * 100}%`,
              }}
            >
              <span>{cue.reference}</span>
            </div>
            {handle("start")}
            {handle("end")}
            {hasPlayhead && (
              <div
                className="waveform-playhead"
                style={{
                  left: `${percent(timelineStart + playhead - sourceStart)}%`,
                }}
              />
            )}
          </div>
        </div>
        {waveError && (
          <button
            type="button"
            className="analysis-retry"
            onClick={() => setRevision((current) => current + 1)}
          >
            {t("Retry loading audio")}
          </button>
        )}
        <div className="waveform-ruler">
          <span>{(window.start - timelineStart).toFixed(2)} s</span>
          <span>
            {((window.start + window.end) / 2 - timelineStart).toFixed(2)} s
          </span>
          <span>{(window.end - timelineStart).toFixed(2)} s</span>
        </div>
        <div className="verse-preview">
          <span className="eyebrow">{cue.reference}</span>
          <p>{cue.text}</p>
          <button type="button" onClick={preview}>
            <span>{playing ? <Pause size={16} /> : <Play size={16} />}</span>
            {playing ? t("Pause") : t("Listen to verse")}
          </button>
        </div>
        <div className="trim-fields">
          {(["start", "end"] as const).map((edge) => (
            <label key={edge}>
              {edge === "start" ? t("Start") : t("End")} ({t("seconds")})
              <input
                type="number"
                step={0.01}
                disabled={disabled}
                value={Number((cue[edge] - timelineStart).toFixed(3))}
                min={0}
                max={duration}
                onChange={(event) => {
                  if (event.target.value !== "")
                    move(
                      edge,
                      timelineStart + Number(event.target.value),
                      true,
                    );
                }}
              />
            </label>
          ))}
        </div>
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setWaveError(true)}
          onTimeUpdate={() => {
            if (!audio.current) return;
            if (audio.current.currentTime >= stopAt.current) {
              audio.current.pause();
              if (audio.current.currentTime > stopAt.current)
                audio.current.currentTime = stopAt.current;
            }
            setPlayhead(audio.current.currentTime);
          }}
        />
      </div>
    </div>
  );
}
