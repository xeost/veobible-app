import React from "react";
import { Video } from "@remotion/media";
import { Audio, Freeze, useCurrentFrame, useVideoConfig } from "remotion";

/** Hold only the video frame after EOF; overlays and audio keep advancing. */
export const BackgroundVideo: React.FC<{
  src: string;
  sourceDuration: number;
  style: React.CSSProperties;
  muted: boolean;
}> = ({ src, sourceDuration, style, muted }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lastFrame = Math.max(0, Math.ceil(sourceDuration * fps) - 1);
  const { objectFit, ...videoStyle } = style;
  const video = (
    <Video
      src={src}
      muted
      objectFit={objectFit as "cover" | "contain" | undefined}
      style={videoStyle}
    />
  );
  return (
    <>
      {frame > lastFrame ? <Freeze frame={lastFrame}>{video}</Freeze> : video}
      {!muted && <Audio src={src} />}
    </>
  );
};
