/**
 * GoldRule – the animated horizontal stroke that draws itself left-to-right
 * (ease-out) during entrance and retracts left during exit, matching the
 * FFmpeg `rule()` helper in motion-design.ts.
 */

import React from "react";
import { easeOut, easeIn, smooth } from "./animation";
import type { Phase } from "./animation";

interface FullProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  t: number;
  phase: Phase;
}

export const GoldRule: React.FC<FullProps> = ({
  x,
  y,
  width,
  height,
  color,
  t,
  phase,
}) => {
  const enterP = easeOut(
    Math.max(
      0,
      Math.min(1, (t - phase.start) / Math.max(0.001, phase.duration)),
    ),
  );
  const exitP = easeIn(
    Math.max(
      0,
      Math.min(1, (t - phase.exit) / Math.max(0.001, phase.exitDuration)),
    ),
  );
  const reveal = enterP * (1 - exitP);
  const fadeAlpha =
    smooth(
      Math.max(
        0,
        Math.min(1, (t - phase.start) / Math.max(0.001, phase.duration)),
      ),
    ) *
    (1 -
      smooth(
        Math.max(
          0,
          Math.min(1, (t - phase.exit) / Math.max(0.001, phase.exitDuration)),
        ),
      ));

  if (fadeAlpha <= 0 || reveal <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: Math.round(width * reveal),
        height,
        backgroundColor: color,
        opacity: fadeAlpha,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    />
  );
};
