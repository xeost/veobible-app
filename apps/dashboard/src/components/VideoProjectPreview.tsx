"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import {
  Clapperboard,
  Film,
  LoaderCircle,
  Play,
  RefreshCw,
} from "lucide-react";
import { VeoBibleShort } from "../../../../tools/video-project-api/src/engines/short/remotion/VeoBibleShort";
import { VeoBibleEpisode } from "../../../../tools/video-project-api/src/engines/long/remotion/VeoBibleEpisode";
import type { ShortCompositionProps } from "../../../../tools/video-project-api/src/engines/short/remotion/types";
import type { RenderRequest } from "../lib/video-schema";
import type { VerseCue } from "../lib/video-timing";
import { useI18n } from "../i18n/context";
import { api } from "./api";

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
  settings,
  cues,
  ready,
  rendered,
  onBackground,
}: {
  kind: "short" | "long";
  endpoint: (action?: string) => string;
  settings: RenderRequest["settings"];
  cues: VerseCue[];
  ready: boolean;
  rendered: boolean;
  onBackground: (background: string) => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"preview" | "rendered">(
    rendered ? "rendered" : "preview",
  );
  const request = useRef<AbortController | null>(null);
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
  const media = (asset: string) =>
    `/api/${endpoint("media")}&asset=${encodeURIComponent(asset)}`;
  const props = useMemo(
    () =>
      preview
        ? {
            ...preview.props,
            verseCues: cues,
            volumeMultiplier: settings.volumeMultiplier,
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
    [preview, cues, settings.volumeMultiplier, endpoint],
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
      setView("preview");
    } catch {
      if (!controller.signal.aborted)
        setError("The preview could not be prepared. Try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const FormatIcon = kind === "short" ? Clapperboard : Film;
  return (
    <div className="project-live-preview">
      <div className="preview-view-actions">
        <button
          type="button"
          disabled={!ready || busy}
          className={view === "preview" ? "active" : ""}
          onClick={() => (preview && !stale ? setView("preview") : void load())}
        >
          {busy ? (
            <LoaderCircle size={15} className="voice-spinner" />
          ) : preview && stale ? (
            <RefreshCw size={15} />
          ) : (
            <Play size={15} />
          )}
          {busy
            ? t("Preparing preview…")
            : stale
              ? t("Refresh preview")
              : t("Preview")}
        </button>
        {preview && !stale && (
          <button
            type="button"
            className="icon-button"
            aria-label={t("Refresh preview")}
            title={t("Refresh preview")}
            disabled={!ready || busy}
            onClick={() => void load()}
          >
            <RefreshCw size={15} />
          </button>
        )}
        {rendered && (
          <button
            type="button"
            className={view === "rendered" ? "active" : ""}
            onClick={() => setView("rendered")}
          >
            {t("Video generated")}
          </button>
        )}
      </div>
      {view === "preview" && preview && props && !stale ? (
        <Player
          component={kind === "short" ? VeoBibleShort : VeoBibleEpisode}
          inputProps={props}
          durationInFrames={preview.durationInFrames}
          compositionWidth={preview.width}
          compositionHeight={preview.height}
          fps={preview.fps}
          controls
          style={{ width: "100%", borderRadius: 12 }}
          errorFallback={() => (
            <p className="notice">
              {t("The preview could not be played. Prepare it again.")}
            </p>
          )}
        />
      ) : view === "rendered" && rendered ? (
        <video
          controls
          preload="metadata"
          className={`studio-video-preview ${kind}`}
          src={media("video")}
          onError={() =>
            setError(
              "The video is unavailable. You can generate it again with your saved settings.",
            )
          }
        />
      ) : (
        <div className={`studio-preview-placeholder ${kind}`}>
          <FormatIcon size={40} />
          <strong>
            {t(kind === "short" ? "Portrait video" : "Landscape video")}
          </strong>
          <span>
            {t(
              ready
                ? "Preview the video with your settings before generating it."
                : "Generate the introduction and closing voices to preview the video.",
            )}
          </span>
        </div>
      )}
      {error && <p className="notice">{t(error)}</p>}
    </div>
  );
}
