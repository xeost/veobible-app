/**
 * Remotion bundle entry point.
 *
 * Registers the VeoBibleShort composition. The composition dimensions and
 * frame count are overridden at render time via `inputProps` / the
 * `selectComposition` + `renderMedia` API in video.ts.
 *
 * The defaults below are representative but not used in production rendering.
 */

import { Composition, registerRoot } from "remotion";
import React from "react";
import { VeoBibleShort } from "./VeoBibleShort";
import type { ShortCompositionProps } from "./types";

const DEFAULT_PROPS: ShortCompositionProps = {
  introLength: 12,
  introVideoDuration: 12,
  outroVideoDuration: 10,
  readingLength: 20,
  outroLength: 10,
  transitionDuration: 0.5,
  readingSilence: 1,
  introVideoPath: "",
  boomerangVideoPath: "",
  outroVideoPath: "",
  sections: [],
  volumeMultiplier: 1,
  introTitle: {
    title: "Esta es tu dosis diaria de la palabra de Dios",
    reference: "Juan 3:16",
    version: "Reina Valera 1909",
  },
  outroTitle: {
    title: "Síguenos",
    highlight: "para escuchar más",
    channel: "VeoBible en Español",
    social: [],
    website: "veobible.com",
  },
  verseCues: [],
  readingPalette: [
    [246, 236, 216],
    [222, 236, 226],
    [240, 224, 210],
    [220, 232, 242],
  ],
};

const fps = 30;

export const RemotionRoot: React.FC = () => {
  // Duration is computed from props at runtime; provide a safe default here.
  const totalSec =
    DEFAULT_PROPS.introLength +
    DEFAULT_PROPS.readingLength +
    DEFAULT_PROPS.outroLength -
    DEFAULT_PROPS.transitionDuration * 2;

  return (
    <Composition
      id="VeoBibleShort"
      component={VeoBibleShort as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={Math.ceil(totalSec * fps)}
      fps={fps}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_PROPS as unknown as Record<string, unknown>}
    />
  );
};

registerRoot(RemotionRoot);
