import React from "react";
import { Video } from "@remotion/media";
import { Audio } from "remotion";

/** Loop the prepared boomerang while overlays and narration follow their own timeline. */
export const BackgroundVideo: React.FC<{
  src: string;
  sourceDuration: number;
  style: React.CSSProperties;
  muted: boolean;
}> = ({ src, style, muted }) => {
  const { objectFit, ...videoStyle } = style;
  const video = (
    <Video
      src={src}
      muted
      loop
      objectFit={objectFit as "cover" | "contain" | undefined}
      style={videoStyle}
    />
  );
  return (
    <>
      {video}
      {!muted && <Audio src={src} />}
    </>
  );
};
