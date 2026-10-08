/**
 * ChromaticBackground – reproduces the `chromaticBase` FFmpeg filter that
 * creates drifting elliptical color fields sampled from the background palette.
 *
 * In the original FFmpeg version this is done with a `geq` filter at 96×160
 * that is then scaled up. In Remotion we render it on a Canvas element.
 *
 * The formula is identical:
 *   field_i = exp(-2 * ((X/W - cx - 0.14*sin(t/13+offset))^2 / sx^2
 *                     + (Y/H - cy - 0.09*cos(t/17+offset))^2 / sy^2))
 *   total   = sum of all fields
 *   channel = sum(color[i][ch] * field[i]) / total
 *   alpha   = 255 * 0.60 * (0.20 + 0.80 * smooth(top) * smooth(bottom))
 *
 * where top  = clip(Y/H / 0.17, 0, 1)
 *       bottom = clip((1-Y/H) / 0.26, 0, 1)
 */

import React, { useEffect, useRef } from "react";
import { smooth } from "./animation";
import type { RGB } from "./types";

// Low-resolution canvas (96×160) that matches the FFmpeg source size.
const SRC_W = 96;
const SRC_H = 160;

const FIELDS: [number, number, number, number, number][] = [
  [0.18, 0.28, 0.5, 0.28, 0],
  [0.8, 0.35, 0.46, 0.32, 1.7],
  [0.28, 0.64, 0.48, 0.3, 3.1],
  [0.82, 0.7, 0.52, 0.26, 4.8],
];

function renderChromatic(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  colors: RGB[],
): void {
  const fields = FIELDS.map(([cx, cy, sx, sy, offset]) => [
    cx + 0.14 * Math.sin(t / 13 + offset),
    cy + 0.09 * Math.cos(t / 17 + offset),
    sx,
    sy,
  ]);
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  for (let py = 0; py < h; py++) {
    const YH = py / h;
    const top = Math.min(1, Math.max(0, YH / 0.17));
    const bottom = Math.min(1, Math.max(0, (1 - YH) / 0.26));
    const a =
      255 * 0.6 * (0.2 + 0.8 * smooth(top) * smooth(bottom));
    for (let px = 0; px < w; px++) {
      const XW = px / w;
      let fieldSum = 0;
      const fieldValues: number[] = fields.map(([cx, cy, sx, sy]) => {
        const dx = (XW - cx) / sx;
        const dy = (YH - cy) / sy;
        const v = Math.exp(-2 * (dx * dx + dy * dy));
        fieldSum += v;
        return v;
      });
      const idx = (py * w + px) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let c = 0;
        for (let fi = 0; fi < FIELDS.length; fi++) {
          c += colors[fi % colors.length][ch] * fieldValues[fi];
        }
        data[idx + ch] = Math.round(fieldSum > 0 ? c / fieldSum : 0);
      }
      data[idx + 3] = Math.round(a);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

interface Props {
  width: number;
  height: number;
  t: number;
  colors: RGB[];
}

export const ChromaticBackground: React.FC<Props> = ({
  width,
  height,
  t,
  colors,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderChromatic(ctx, SRC_W, SRC_H, t, colors);
  }, [t, colors]);

  return (
    <canvas
      ref={canvasRef}
      width={SRC_W}
      height={SRC_H}
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        imageRendering: "auto", // bilinear scaling like FFmpeg
        pointerEvents: "none",
      }}
    />
  );
};
