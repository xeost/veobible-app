import React from "react";
import { Composition, registerRoot, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { BackgroundVideo } from "../BackgroundVideo";

const Motion: React.FC<{ src: string; loop: boolean }> = ({ src, loop }) => loop
  ? <Video src={staticFile(src)} loop muted />
  : <BackgroundVideo src={staticFile(src)} sourceDuration={0.5} muted style={{ width: "100%", height: "100%" }} />;

registerRoot(() => <Composition id="Motion" component={Motion} fps={24} width={128} height={228}
  durationInFrames={24} defaultProps={{ src: "motion.mp4", loop: false }} />);
