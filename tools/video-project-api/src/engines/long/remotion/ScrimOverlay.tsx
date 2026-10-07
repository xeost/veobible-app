/**
 * ScrimOverlay – renders the dark translucent scrim that matches the FFmpeg
 * scrim filter. Uses a CSS gradient that reproduces the band calculation
 * (smooth-step from top 9→25%, clear bottom 55→81%).
 *
 * The `overlayLift` offset (140 artboard pixels) shifts the whole artboard up,
 * so the overlay effectively starts lower on screen, clear of device chrome.
 */

import React from "react";
import { phaseAlpha, smooth } from "./animation";
import type { Phase } from "./animation";

interface Props {
  width: number;
  height: number;
  t: number;
  phase: Phase;
  maxOpacity?: number;
}

export const ScrimOverlay: React.FC<Props> = ({
  width,
  height,
  t,
  phase,
  maxOpacity = 0.5,
}) => {
  const alpha = phaseAlpha(t, phase);
  if (alpha <= 0) return null;

  // Replicate the band computation from the FFmpeg scrim generator.
  // overlayLift / 1920 ≈ 0.073 shifts the band reference up.
  const overlayLift = 0;

  // We'll build a CSS gradient string that approximates the scrim.
  // Because CSS can't do arbitrary pixel-by-pixel opacity, we sample
  // key points and produce a multi-stop gradient.
  const samples: Array<{ pct: number; opacity: number }> = [];
  const count = 64; // enough stops for a smooth result
  for (let i = 0; i <= count; i++) {
    const t2 = i / count;
    const ty = t2 + overlayLift;
    const top = Math.min(1, Math.max(0, (ty - 0.09) / 0.16));
    const bottom = Math.min(1, Math.max(0, (1.08 - ty) / 0.18));
    const opacity = maxOpacity * smooth(top) * smooth(bottom);
    samples.push({ pct: t2 * 100, opacity });
  }

  const stops = samples
    .map(
      ({ pct, opacity }) =>
        `rgba(16,27,28,${(opacity * alpha).toFixed(4)}) ${pct.toFixed(1)}%`,
    )
    .join(", ");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        background: `linear-gradient(to bottom, ${stops})`,
        pointerEvents: "none",
      }}
    />
  );
};
