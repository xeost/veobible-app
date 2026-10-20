"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Play,
  Pause,
  AudioLines,
  ZoomIn,
  ZoomOut,
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronRight,
  ListVideo,
  AlignStartVertical,
  RotateCcw,
} from "lucide-react";
import {
  readingPlaybackSpeeds,
  useReadingPlaybackSpeed,
} from "./useReadingPlaybackSpeed";
import { applyReadingPlaybackSpeed } from "../lib/reading-playback";
import { useI18n } from "../i18n/context";
import {
  type VerseCue,
  alignSelectedVerse,
  trimBounds,
  trimCue,
  trimPreviewRange,
  waveformSeekRange,
  waveformWindow,
} from "../lib/video-timing";
import { useAudioWaveform, type WaveformPreparation } from "./useAudioWaveform";
import { waveformPeaks } from "../lib/audio-waveform";
export function VerseWaveform({
  src,
  expanded,
  resourceKey,
  onPrepared,
  locale,
  sourceStart,
  sourceEnd,
  sourceDuration,
  onExpand,
  timelineStart,
  volumeMultiplier,
  cues,
  disabled,
  onTrim,
  onShift,
  preservedReferences,
  resetRevision = 0,
  onRegenerate,
  compact = false,
  textOnly = false,
  selectedReference,
  onSelectReference,
  toolbarLeading,
  toolbarActions,
  regenerateLabel = "Regenerate reading voice",
  children,
}: WaveformPreparation & {
  expanded: boolean;
  src: string;
  locale: string;
  sourceStart: number;
  sourceEnd: number;
  sourceDuration: number;
  onExpand: (edge: "start" | "end") => void;
  timelineStart: number;
  volumeMultiplier: number;
  cues: VerseCue[];
  disabled: boolean;
  onTrim: (reference: string, edge: "start" | "end", value: number) => void;
  onShift: (cue: VerseCue, manuallyAdjusted: boolean) => boolean;
  preservedReferences: string[];
  resetRevision?: number;
  onRegenerate?: () => void;
  compact?: boolean;
  textOnly?: boolean;
  selectedReference?: string;
  onSelectReference?: (reference: string) => void;
  toolbarLeading?: ReactNode;
  toolbarActions?: ReactNode;
  regenerateLabel?: string;
  children?:
    | ReactNode
    | ((
        cue: VerseCue,
        selectReference: (reference: string) => void,
      ) => ReactNode);
}) {
  const { t } = useI18n();
  const { playbackSpeed, setPlaybackSpeed } = useReadingPlaybackSpeed(locale);
  const [selected, setSelected] = useState(0);
  const {
    data,
    error: waveError,
    setError: setWaveError,
    retry,
  } = useAudioWaveform(src, { resourceKey, onPrepared }, !textOnly);
  const [focus, setFocus] = useState(
    cues[0] ?? {
      start: timelineStart,
      end: timelineStart + sourceEnd - sourceStart,
    },
  );
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [hasPlayhead, setHasPlayhead] = useState(false);
  const [extraContext, setExtraContext] = useState({ before: 0, after: 0 });
  const [zoom, setZoom] = useState(1);
  const audio = useRef<HTMLAudioElement>(null);
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  useEffect(() => {
    if (audio.current) applyReadingPlaybackSpeed(audio.current, playbackSpeed);
  }, [playbackSpeed]);
  const audioGraph = useRef<{
    context: AudioContext;
    source: MediaElementAudioSourceNode;
    gain: GainNode;
  } | null>(null);
  const volume = useRef(volumeMultiplier);
  volume.current = volumeMultiplier;
  const applyVolume = () => {
    const player = audio.current;
    if (!player) return;
    const graph = audioGraph.current;
    // Use native volume until the audio graph is ready, then apply the full
    // multiplier through gain so amplified and muted readings behave alike.
    player.volume = graph ? 1 : Math.min(1, volume.current);
    if (graph)
      graph.gain.gain.setValueAtTime(volume.current, graph.context.currentTime);
  };
  useEffect(() => {
    applyVolume();
  }, [volumeMultiplier]);
  useEffect(
    () => () => {
      const graph = audioGraph.current;
      if (!graph) return;
      audioGraph.current = null;
      graph.source.disconnect();
      graph.gain.disconnect();
      if (graph.context.state !== "closed") void graph.context.close();
    },
    [],
  );
  const picker = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const stopAt = useRef(sourceEnd);
  const playbackRequest = useRef(0);
  const playOnSelection = useRef<string | null>(null);
  const draggedCue = useRef<VerseCue | null>(null);
  const latest = useRef(cues);
  latest.current = cues;
  const duration = sourceEnd - sourceStart;
  const controlledIndex = cues.findIndex(
    (cue) => cue.reference === selectedReference,
  );
  const index =
    controlledIndex >= 0
      ? controlledIndex
      : Math.min(selected, Math.max(0, cues.length - 1));
  const cue = cues[index];
  useEffect(() => {
    const list = picker.current;
    const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !active) return;
    const viewport = list.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    // Scroll only the verse list, including its horizontal layout on narrow screens.
    if (item.top < viewport.top) list.scrollTop += item.top - viewport.top - 4;
    else if (item.bottom > viewport.bottom)
      list.scrollTop += item.bottom - viewport.bottom + 4;
    if (item.left < viewport.left)
      list.scrollLeft += item.left - viewport.left - 4;
    else if (item.right > viewport.right)
      list.scrollLeft += item.right - viewport.right + 4;
  }, [index, cue?.reference]);
  useEffect(() => {
    if (!expanded) {
      audio.current?.pause();
      playbackRequest.current++;
      playOnSelection.current = null;
    }
  }, [expanded]);
  useEffect(() => {
    const player = audio.current;
    return () => {
      player?.pause();
    };
  }, []);
  const window = waveformWindow(
    {
      start: focus.start - extraContext.before,
      end: focus.end + extraContext.after,
    },
    timelineStart,
    timelineStart + duration,
  );
  const visibleDuration = window.end - window.start;
  useEffect(() => {
    if (latest.current[index]) setFocus(latest.current[index]);
    audio.current?.pause();
    playbackRequest.current++;
    setHasPlayhead(false);
    setZoom(1);
    if (scroll.current) scroll.current.scrollLeft = 0;
    const requestedVerse = playOnSelection.current;
    playOnSelection.current = null;
    if (requestedVerse && requestedVerse === cue?.reference)
      void playRange(latest.current[index]);
  }, [
    cue?.reference,
    src,
    sourceStart,
    sourceEnd,
    timelineStart,
    resetRevision,
  ]);
  useEffect(
    () => setExtraContext({ before: 0, after: 0 }),
    [cue?.reference, src, resetRevision],
  );
  const peaks = useMemo(
    () =>
      data && visibleDuration > 0
        ? waveformPeaks(
            data,
            Math.max(0, sourceStart + window.start - timelineStart),
            visibleDuration,
            1000,
          )
        : [],
    [data, sourceStart, timelineStart, window.start, visibleDuration],
  );
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
    applyReadingPlaybackSpeed(player, playbackSpeedRef.current);
    player.currentTime = sourceStart + range.start - timelineStart;
    stopAt.current = sourceStart + range.end - timelineStart;
    setPlayhead(player.currentTime);
    setHasPlayhead(true);
    try {
      // Native media volume is capped at 1; a gain node also supports amplified reading.
      if (!audioGraph.current) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(player);
        const gain = context.createGain();
        source.connect(gain);
        gain.connect(context.destination);
        audioGraph.current = { context, source, gain };
      }
      const graph = audioGraph.current;
      applyVolume();
      await Promise.all([graph.context.resume(), player.play()]);
      if (request === playbackRequest.current)
        applyReadingPlaybackSpeed(player, playbackSpeedRef.current, true);
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
        aria-label={`${t(edge === "start" ? t("Start") : t("End"))} · ${cue.reference}`}
        aria-valuemin={bounds[`${edge}Min`]}
        aria-valuemax={bounds[`${edge}Max`]}
        aria-valuenow={cue[edge]}
        aria-valuetext={`${(cue[edge] - timelineStart).toFixed(2)} ${t("seconds")}`}
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
  const selectVerse = (
    nextIndex: number,
    forceAlignment = false,
    autoplay = false,
  ) => {
    if (!latest.current[nextIndex]) return;
    playOnSelection.current = autoplay
      ? latest.current[nextIndex].reference
      : null;
    audio.current?.pause();
    playbackRequest.current++;
    const result = alignSelectedVerse(
      latest.current,
      nextIndex,
      timelineStart + sourceDuration - sourceStart,
      !forceAlignment &&
        preservedReferences.includes(latest.current[nextIndex].reference),
    );
    const moved =
      !textOnly &&
      !disabled &&
      result.moved &&
      onShift(result.cue, forceAlignment);
    setSelected(nextIndex);
    onSelectReference?.(latest.current[nextIndex].reference);
    setFocus(moved ? result.cue : latest.current[nextIndex]);
    setExtraContext({ before: 0, after: 0 });
    setHasPlayhead(false);
    setZoom(1);
    if (scroll.current) scroll.current.scrollLeft = 0;
  };
  const alignment = cue
    ? alignSelectedVerse(
        cues,
        index,
        timelineStart + sourceDuration - sourceStart,
      )
    : null;
  if (!cue)
    return (
      <p className="muted">
        {t("There are no verses to synchronize in this section.")}
      </p>
    );
  return (
    <>
      <div className={`verse-sync${compact ? " verse-sync-compact" : ""}`}>
        {!compact && (
          <div className="verse-picker" ref={picker}>
            {cues.map((verse, i) => (
              <button
                type="button"
                key={verse.reference}
                className={index === i ? "active" : ""}
                aria-pressed={index === i}
                onClick={() => selectVerse(i)}
              >
                <span>{verse.reference}</span>
                {!textOnly && (
                  <small>
                    {(verse.start - timelineStart).toFixed(2)}–
                    {(verse.end - timelineStart).toFixed(2)} s
                  </small>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="sync-workspace">
          {!textOnly && (
            <>
              <div className="sync-heading">
                {toolbarLeading}
                {!compact && (
                  <>
                    <AudioLines size={18} />
                    <strong>{t("Synchronize text and audio")}</strong>
                  </>
                )}
                <div>
                  {toolbarActions}
                  <select
                    className="waveform-playback-speed"
                    aria-label={t("Playback speed")}
                    data-tooltip={t(
                      "Playback speed for listening in the editor only. Saved for this Bible language; previews and the final video keep their original speed.",
                    )}
                    value={playbackSpeed}
                    onChange={(event) =>
                      setPlaybackSpeed(Number(event.target.value))
                    }
                  >
                    {readingPlaybackSpeeds.map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}×
                      </option>
                    ))}
                  </select>
                  <span
                    className="section-action-separator"
                    aria-hidden="true"
                  />
                  {(["start", "end"] as const).map((edge) => {
                    const label =
                      edge === "start"
                        ? "Add up to 10 seconds of audio on the left"
                        : "Add up to 10 seconds of audio on the right";
                    const unavailable =
                      edge === "start"
                        ? sourceStart <= 0
                        : sourceEnd >= sourceDuration - 0.001;
                    return (
                      <button
                        type="button"
                        key={edge}
                        className="waveform-context-button"
                        aria-label={t(label)}
                        data-tooltip={t(label)}
                        disabled={disabled || unavailable}
                        onClick={() => {
                          onExpand(edge);
                          setExtraContext((current) => ({
                            ...current,
                            [edge === "start" ? "before" : "after"]:
                              current[edge === "start" ? "before" : "after"] +
                              10,
                          }));
                        }}
                      >
                        {edge === "start" ? (
                          <ArrowLeftToLine size={16} />
                        ) : (
                          <ArrowRightToLine size={16} />
                        )}
                        <span>+10 s</span>
                      </button>
                    );
                  })}
                  <span
                    className="section-action-separator"
                    aria-hidden="true"
                  />
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
              {!compact && (
                <p className="muted">
                  {t(
                    "Release an edge to hear 3 seconds from that side. Click inside the fragment to listen from that point to the end. Use the arrow keys for precise adjustments.",
                  )}
                </p>
              )}
              <div className="waveform-scroll" ref={scroll}>
                <div
                  className="waveform-track"
                  ref={track}
                  style={{ width: `${zoom * 100}%` }}
                  onClick={(event) => {
                    const box = event.currentTarget.getBoundingClientRect();
                    const time =
                      window.start +
                      ((event.clientX - box.left) / box.width) *
                        visibleDuration;
                    const range = waveformSeekRange(
                      latest.current[index],
                      time,
                    );
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
                  onClick={retry}
                >
                  {t("Retry loading audio")}
                </button>
              )}
              <div className="waveform-ruler">
                <span>{(window.start - timelineStart).toFixed(2)} s</span>
                <span>
                  {((window.start + window.end) / 2 - timelineStart).toFixed(2)}{" "}
                  s
                </span>
                <span>{(window.end - timelineStart).toFixed(2)} s</span>
              </div>
              <div className="verse-playback">
                <button
                  type="button"
                  className="icon-button verse-playback-icon"
                  aria-label={t(
                    onRegenerate
                      ? regenerateLabel
                      : "Align with previous verse",
                  )}
                  disabled={disabled || (!onRegenerate && !alignment?.moved)}
                  data-tooltip={t(
                    onRegenerate
                      ? regenerateLabel
                      : "Move both trim edges so this verse starts at the previous verse’s end, keeping its duration. Your other verse cuts stay unchanged.",
                  )}
                  onClick={() =>
                    onRegenerate ? onRegenerate() : selectVerse(index, true)
                  }
                >
                  {onRegenerate ? (
                    <RotateCcw size={16} aria-hidden="true" />
                  ) : (
                    <AlignStartVertical size={16} aria-hidden="true" />
                  )}
                </button>
                <span className="section-action-separator" aria-hidden="true" />
                <button
                  type="button"
                  className="icon-button verse-playback-icon"
                  aria-label={t(playing ? "Pause" : "Listen to verse")}
                  data-tooltip={t(playing ? "Pause" : "Listen to verse")}
                  onClick={preview}
                >
                  {playing ? (
                    <Pause size={16} aria-hidden="true" />
                  ) : (
                    <Play size={16} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className="icon-button verse-playback-icon"
                  aria-label={t("Next verse")}
                  data-tooltip={t("Next verse")}
                  disabled={index >= cues.length - 1}
                  onClick={() => selectVerse(index + 1)}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button verse-playback-icon"
                  aria-label={t("Next verse and play")}
                  data-tooltip={t("Next verse and play")}
                  disabled={index >= cues.length - 1}
                  onClick={() => selectVerse(index + 1, false, true)}
                >
                  <ListVideo size={16} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
          {!compact && (
            <div className="verse-preview">
              <span className="eyebrow">{cue.reference}</span>
              <p>{cue.text}</p>
            </div>
          )}
          {typeof children === "function"
            ? children(cue, (reference) => {
                const next = latest.current.findIndex(
                  (verse) => verse.reference === reference,
                );
                if (next >= 0) setSelected(next);
              })
            : children}
          {!textOnly && (
            <audio
              ref={audio}
              crossOrigin="anonymous"
              src={src}
              preload="metadata"
              onLoadedMetadata={(event) => {
                applyVolume();
                applyReadingPlaybackSpeed(
                  event.currentTarget,
                  playbackSpeedRef.current,
                );
              }}
              onPlay={(event) => {
                applyVolume();
                applyReadingPlaybackSpeed(
                  event.currentTarget,
                  playbackSpeedRef.current,
                );
                setPlaying(true);
              }}
              onSeeked={(event) =>
                applyReadingPlaybackSpeed(
                  event.currentTarget,
                  playbackSpeedRef.current,
                  true,
                )
              }
              onPlaying={(event) =>
                applyReadingPlaybackSpeed(
                  event.currentTarget,
                  playbackSpeedRef.current,
                  true,
                )
              }
              onRateChange={(event) => {
                if (
                  event.currentTarget.playbackRate !== playbackSpeedRef.current
                )
                  applyReadingPlaybackSpeed(
                    event.currentTarget,
                    playbackSpeedRef.current,
                  );
              }}
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
          )}
        </div>
      </div>
    </>
  );
}
