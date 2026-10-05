/**
 * AnimatedText – renders a single text element with phase-based alpha and
 * vertical translation, matching the `drawtext` filter used in motion-design.ts.
 *
 * fontFamily values correspond to the font names used in the FFmpeg filters:
 *   "Avenir"              → sans
 *   "Avenir Next Demi Bold" → sansSemibold
 *   "Georgia"             → serif
 *   "Georgia Italic"      → italic (italic variant)
 */

import React from "react";
import { fitFontSize } from "./animation";

interface Props {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  alpha: number;
  shadow?: number;
  width?: number;
}

export const AnimatedText: React.FC<Props> = ({
  text,
  x,
  y,
  fontSize,
  fontFamily,
  color,
  alpha,
  shadow = 0.28,
  width = 800,
}) => {
  if (!text || alpha <= 0) return null;

  // Fit font size to width (same as FFmpeg's fit() function).
  const fitted = Math.max(1, Math.round(fitFontSize(text, fontSize, width)));

  const isItalic = fontFamily.includes("Italic");
  const isBold = fontFamily.includes("Demi Bold") || fontFamily.includes("Bold");
  const baseName = fontFamily
    .replace(" Italic", "")
    .replace(" Demi Bold", "")
    .replace(" Next", "");

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontSize: fitted,
        fontFamily: `${baseName}, serif`,
        fontStyle: isItalic ? "italic" : "normal",
        fontWeight: isBold ? 600 : 400,
        color,
        opacity: alpha,
        whiteSpace: "pre-line",
        textShadow: shadow > 0 ? `0px 2px rgba(7,16,13,${shadow})` : undefined,
        lineHeight: "1.28",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {text}
    </div>
  );
};
