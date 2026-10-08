"use client";
import {
  insertChapterIntroductions,
  type VoicePart,
} from "../../../../tools/video-project-api/src/chapter-introductions";
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
import {
  previewDurationInFrames,
  stopPreviewMedia,
  stopPreviewPlayback,
} from "../lib/preview-playback";
import { Clapperboard, Film } from "lucide-react";
import { VeoBibleShort } from "../../../../tools/video-project-api/src/engines/short/remotion/VeoBibleShort";
import { VeoBibleEpisode } from "../../../../tools/video-project-api/src/engines/long/remotion/VeoBibleEpisode";
import { ReadingScene as ShortReading } from "../../../../tools/video-project-api/src/engines/short/remotion/ReadingScene";
import { ReadingScene as LongReading } from "../../../../tools/video-project-api/src/engines/long/remotion/ReadingScene";
import { IntroScene as ShortIntro } from "../../../../tools/video-project-api/src/engines/short/remotion/IntroScene";
import { IntroScene as LongIntro } from "../../../../tools/video-project-api/src/engines/long/remotion/IntroScene";
import { OutroScene as ShortOutro } from "../../../../tools/video-project-api/src/engines/short/remotion/OutroScene";
import { OutroScene as LongOutro } from "../../../../tools/video-project-api/src/engines/long/remotion/OutroScene";
import type { ShortCompositionProps } from "../../../../tools/video-project-api/src/engines/short/remotion/types";
import type { RenderRequest } from "../lib/video-schema";
import { useI18n } from "../i18n/context";
import { api } from "./api";
import {
  waveformReadingSources,
  type ReadingSection,
  type VerseCue,
} from "../lib/video-timing";
import { readingPadding } from "../../../../tools/video-project-api/src/composition-timing";
import { buildVerseReading } from "../../../../tools/video-project-api/src/reading-timeline";
import { layoutVerse as shortVerseLayout } from "../../../../tools/video-project-api/src/engines/short/remotion/animation";
import { layoutVerse as longVerseLayout } from "../../../../tools/video-project-api/src/engines/long/remotion/animation";

export type PreviewPlaybackHandle = {
  stop(): void;
  dispose(): void;
};

export type VideoPreviewView = "composition" | "rendered";

function SectionPreview(
  props: ShortCompositionProps & {
    previewKind?: "short" | "long";
    previewVoicePart?: VoicePart;
  },
) {
  if (props.previewVoicePart === "intro") {
    const Intro = props.previewKind === "long" ? LongIntro : ShortIntro;
    return (
      <Intro
        introVideoPath={props.introVideoPath}
        introDuration={props.introVideoDuration}
        introLength={props.introLength}
        title={props.introTitle}
        voices={props.voices}
      />
    );
  }
  if (props.previewVoicePart === "outro") {
    const Outro = props.previewKind === "long" ? LongOutro : ShortOutro;
    return (
      <Outro
        outroVideoPath={props.outroVideoPath}
        outroDuration={props.outroVideoDuration}
        outroLength={props.outroLength}
        outro={props.outroTitle}
        voices={props.voices}
      />
    );
  }
  const Reading = props.previewKind === "long" ? LongReading : ShortReading;
  return (
    <Reading
      {...props}
      voices={undefined}
      readingDuration={props.readingLength - readingPadding(props)}
    />
  );
}

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
  readingReferences,
  readingCues,
  readingSources,
  voicePart,
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
  readingReferences?: string[];
  readingCues?: VerseCue[];
  readingSources?: ReadingSection[];
  voicePart?: VoicePart;
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
  const reading = useMemo(() => {
    if (voicePart || !readingCues || !readingSources) return null;
    const selectedCues = readingReferences
      ? readingCues.filter((cue) => readingReferences.includes(cue.reference))
      : readingCues;
    const layout = kind === "short" ? shortVerseLayout : longVerseLayout;
    const lineCounts = selectedCues.map((cue) => layout(cue.text).lines.length);
    const base = buildVerseReading(
      waveformReadingSources(readingSources),
      selectedCues,
      lineCounts,
    );
    return insertChapterIntroductions(
      base,
      readingReferences ? [] : (preview?.props.chapterIntroductions ?? []),
      lineCounts,
    );
  }, [
    readingReferences,
    readingCues,
    readingSources,
    kind,
    voicePart,
    preview,
  ]);
  const props = useMemo(
    () =>
      preview
        ? {
            ...preview.props,
            // Prepared cues use the same cut-and-transition timeline as final rendering.
            // Only ReadingScene consumes this gain; narration keeps its original volume.
            volumeMultiplier: readingVolume,
            introVideoPath: media(preview.props.introVideoPath),
            boomerangVideoPath: media(preview.props.boomerangVideoPath),
            outroVideoPath: media(preview.props.outroVideoPath),
            // Use the same source audio and current cuts as the waveform, not a prepared snapshot.
            ...(reading
              ? {
                  verseCues: reading.cues,
                  readingLength:
                    reading.duration + readingPadding(preview.props),
                }
              : {}),
            chapterIntroductions: (
              reading?.chapters ?? preview.props.chapterIntroductions
            )?.map((chapter) => ({ ...chapter, file: media(chapter.file) })),
            sections: (reading?.sections ?? preview.props.sections).map(
              (section) => ({
                ...section,
                file: media(section.file),
              }),
            ),
            voices: preview.props.voices
              ? {
                  ...preview.props.voices,
                  intro: media(preview.props.voices.intro),
                  outro: media(preview.props.voices.outro),
                }
              : undefined,
          }
        : null,
    [preview, reading, readingVolume, media],
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
        body: JSON.stringify({
          ...settings,
          readingReferences,
          voicePart,
          readingCuts: readingCues?.map(({ reference, start, end }) => ({
            reference,
            start,
            end,
          })),
        }),
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
    // Prepare cuts and transition timings on opening; volume changes update the player directly.
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
            component={
              readingReferences || voicePart
                ? SectionPreview
                : kind === "short"
                  ? VeoBibleShort
                  : VeoBibleEpisode
            }
            inputProps={{
              ...props,
              previewKind: kind,
              previewVoicePart: voicePart,
            }}
            durationInFrames={previewDurationInFrames(
              { ...preview, props },
              voicePart ?? (readingReferences ? "reading" : undefined),
            )}
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
                  : kind === "long"
                    ? "Generate all section narrations to preview the video."
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
