"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { useI18n } from "../i18n/context";

const clock = (time: number) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
export function AudioTakePlayer({
  src,
  label,
  onTime,
  onPlay,
}: {
  src: string;
  label: string;
  onTime?: (time: number) => void;
  onPlay?: () => void;
}) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    const syncDuration = () =>
      setDuration(Number.isFinite(player.duration) ? player.duration : 0);
    syncDuration();
    player.addEventListener("durationchange", syncDuration);
    return () => player.removeEventListener("durationchange", syncDuration);
  }, [src]);
  return (
    <div className="audio-take-player">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        aria-label={label}
        onLoadedMetadata={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          )
        }
        onTimeUpdate={(event) => {
          setTime(event.currentTarget.currentTime);
          onTime?.(event.currentTarget.currentTime);
        }}
        onPlay={() => {
          setPlaying(true);
          onPlay?.();
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <button
        type="button"
        className="icon-button"
        aria-label={`${t(playing ? "Pause" : "Play")} · ${label}`}
        disabled={failed}
        onClick={() => {
          if (playing) audio.current?.pause();
          else void audio.current?.play().catch(() => setFailed(true));
        }}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.01}
        value={Math.min(time, duration || 1)}
        aria-label={`${t("Playback position")} · ${label}`}
        disabled={!duration || failed}
        onChange={(event) => {
          if (audio.current) {
            const value = Number(event.target.value);
            audio.current.currentTime = value;
            setTime(value);
            onTime?.(value);
          }
        }}
      />
      <span className="audio-take-time">
        {clock(time)} / {clock(duration)}
      </span>
      <Volume2 size={15} aria-hidden="true" />
      <input
        className="audio-take-volume"
        type="range"
        min={0}
        max={1}
        step={0.01}
        defaultValue={1}
        aria-label={`${t("Volume")} · ${label}`}
        onChange={(event) => {
          if (audio.current) audio.current.volume = Number(event.target.value);
        }}
      />
      {failed && (
        <small role="alert">
          {t("Could not play this audio. Reload and try again.")}
        </small>
      )}
    </div>
  );
}
