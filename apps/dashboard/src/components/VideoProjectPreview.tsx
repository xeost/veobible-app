"use client";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { stopPreviewMedia, stopPreviewPlayback } from "../lib/preview-playback";
import { Clapperboard, Film } from "lucide-react";
import { VeoBibleShort } from "../../../../tools/video-project-api/src/engines/short/remotion/VeoBibleShort";
import { VeoBibleEpisode } from "../../../../tools/video-project-api/src/engines/long/remotion/VeoBibleEpisode";
import type { ShortCompositionProps } from "../../../../tools/video-project-api/src/engines/short/remotion/types";
import type { RenderRequest } from "../lib/video-schema";
import type { VerseCue } from "../lib/video-timing";
import { useI18n } from "../i18n/context";
import { api } from "./api";

export type PreviewPlaybackHandle = {
  stop(): void;
  dispose(): void;
};

export type VideoPreviewView = "composition" | "rendered";

type Preview = {
  props: ShortCompositionProps;
  background: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};
export function VideoProjectPreview({
  kind,
  endpoint,
  media,
  settings,
  readingVolume,
  cues,
  ready,
  rendered,
  view,
  playbackRef,
  onBackground,
}: {
  kind: "short" | "long";
  endpoint: (action?: string) => string;
  media: (asset: string) => string;
  settings: RenderRequest["settings"];
  readingVolume: number;
  cues: VerseCue[];
  ready: boolean;
  rendered: boolean;
  view: VideoPreviewView;
  playbackRef: Ref<PreviewPlaybackHandle>;
  onBackground: (background: string) => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [renderedError, setRenderedError] = useState("");
  const request = useRef<AbortController | null>(null);
  const player = useRef<PlayerRef | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const stop = useCallback(() => {
    stopPreviewPlayback(
      player.current,
      root.current?.querySelectorAll<HTMLMediaElement>("audio, video") ?? [],
    );
  }, []);
  const dispose = useCallback(() => {
    request.current?.abort();
    stop();
  }, [stop]);
  useImperativeHandle(playbackRef, () => ({ stop, dispose }), [stop, dispose]);
  useLayoutEffect(() => dispose, [dispose]);
  useLayoutEffect(() => {
    // A tab change is stopped before rendering by the modal; cleanup here would
    // clear the incoming tab's media after React has already replaced the DOM.
    if (view === "composition" && !ready) stop();
  }, [view, ready, stop]);
  const attachPlayer = useCallback((next: PlayerRef | null) => {
    // Player handles briefly detach on updates; retain the latest one for teardown.
    if (next) player.current = next;
  }, []);
  const attachVideo = useCallback((next: HTMLVideoElement | null) => {
    if (video.current && video.current !== next)
      stopPreviewMedia(video.current);
    video.current = next;
  }, []);
  const signature = JSON.stringify({
    passageOffsets: settings.passageOffsets,
    background: settings.background,
  });
  const preparedSignature = useRef("");
  const stale = preview && preparedSignature.current !== signature;
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!ready) {
      request.current?.abort();
      setPreview(null);
      setBusy(false);
    }
  }, [ready]);
  const props = useMemo(
    () =>
      preview
        ? {
            ...preview.props,
            verseCues: cues,
            // Only ReadingScene consumes this gain; narration keeps its original volume.
            volumeMultiplier: readingVolume,
            introVideoPath: media(preview.props.introVideoPath),
            boomerangVideoPath: media(preview.props.boomerangVideoPath),
            outroVideoPath: media(preview.props.outroVideoPath),
            sections: preview.props.sections.map((section) => ({
              ...section,
              file: media(section.file),
            })),
            voices: preview.props.voices
              ? {
                  ...preview.props.voices,
                  intro: media(preview.props.voices.intro),
                  outro: media(preview.props.voices.outro),
                }
              : undefined,
          }
        : null,
    [preview, cues, readingVolume, media],
  );
  const load = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const data = await api<Preview>(endpoint("preview"), {
        method: "POST",
        body: JSON.stringify(settings),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      preparedSignature.current = JSON.stringify({
        passageOffsets: settings.passageOffsets,
        background: data.background,
      });
      onBackground(data.background);
      setPreview(data);
    } catch {
      if (!controller.signal.aborted)
        setError("The preview could not be prepared. Try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  useEffect(() => {
    if (!ready) return;
    // Prepare on opening or when narration becomes available; local timing and volume changes update the player directly.
    void load();
    return () => request.current?.abort();
  }, [ready, endpoint]);
  const FormatIcon = kind === "short" ? Clapperboard : Film;
  return (
    <div className="project-live-preview" ref={root}>
      <div
        className="preview-stage"
        style={
          {
            "--preview-aspect-ratio": kind === "short" ? 9 / 16 : 16 / 9,
          } as CSSProperties
        }
      >
        {view === "composition" && preview && props && !stale ? (
          <Player
            ref={attachPlayer}
            component={kind === "short" ? VeoBibleShort : VeoBibleEpisode}
            inputProps={props}
            durationInFrames={preview.durationInFrames}
            compositionWidth={preview.width}
            compositionHeight={preview.height}
            fps={preview.fps}
            controls
            autoPlay
            renderPlayPauseButton={({ playing }) =>
              playing ? null : (
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <polygon points="6,3 21,12 6,21" fill="white" />
                </svg>
              )
            }
            style={{
              width: "min(100cqw, calc(100cqh * var(--preview-aspect-ratio)))",
              borderRadius: 12,
            }}
            errorFallback={() => (
              <p className="notice">
                {t("The preview could not be played. Prepare it again.")}
              </p>
            )}
          />
        ) : view === "rendered" && rendered && !renderedError ? (
          <video
            ref={attachVideo}
            autoPlay
            controls
            preload="metadata"
            className={`studio-video-preview ${kind}`}
            src={media("video")}
            onError={() =>
              setRenderedError(
                "The video is unavailable. You can generate it again with your saved settings.",
              )
            }
          />
        ) : view === "rendered" ? (
          <p className="preview-unavailable" role="status">
            {t(
              renderedError ||
                "No final video has been generated yet. Generate the video to preview it here.",
            )}
          </p>
        ) : (
          <div className={`studio-preview-placeholder ${kind}`}>
            <FormatIcon size={40} />
            <strong>
              {t(kind === "short" ? "Portrait video" : "Landscape video")}
            </strong>
            <span role={busy ? "status" : undefined}>
              {t(
                ready
                  ? "Preparing preview…"
                  : "Generate the introduction and closing voices to preview the video.",
              )}
            </span>
          </div>
        )}
      </div>
      {view === "composition" && error && <p className="notice">{t(error)}</p>}
    </div>
  );
}
