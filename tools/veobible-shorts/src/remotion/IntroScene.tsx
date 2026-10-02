/**
 * IntroScene – React component for the intro segment of a VeoBible Short.
 *
 * Mirrors the `introGraph` FFmpeg filter chain from motion-design.ts:
 * - Dark scrim overlay with vignette
 * - VEOBIBLE wordmark (spaced caps)
 * - Title line 1 (small, Avenir)
 * - Title line 2 (large italic, Georgia Italic)
 * - Title line 3 (medium, Georgia)
 * - Reference (Georgia)
 * - Version (muted, Avenir)
 * - Gold rule stroke
 */

import React from "react";
import { BackgroundVideo } from "./BackgroundVideo";
import { useCurrentFrame, useVideoConfig, Audio } from "remotion";
import {
  stagePhase,
  wrapIntroTitle,
  phaseAlpha,
  phaseY,
  positionY,
  introVersionDelay,
} from "./animation";
import type { IntroTitle, VoiceTracks } from "./types";
import { ScrimOverlay } from "./ScrimOverlay";
import { AnimatedText } from "./AnimatedText";
import { GoldRule } from "./GoldRule";

// ─── design tokens (1080 × 1920 artboard) ────────────────────────────────────
const palette = {
  paper: "#FFF8EA",
  gold: "#E8C68A",
  muted: "#CFD4D0",
  ink: "#101B1C",
};

interface IntroSceneProps {
  introVideoPath: string;
  introDuration: number; // actual clip duration in seconds
  introLength: number; // desired padded segment length in seconds
  title: IntroTitle;
  voices?: VoiceTracks;
  introAudioPath?: string; // original clip audio (when mode==="mix")
}

export const IntroScene: React.FC<IntroSceneProps> = ({
  introVideoPath,
  introDuration,
  introLength,
  title,
  voices,
  introAudioPath,
}) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;

  const sx = (v: number) => Math.round((v * width) / 1080);
  const sy = (v: number) => Math.round((v * height) / 1920);

  const introPhase = (delay: number, exitOrder = 0) =>
    stagePhase(introLength, delay, exitOrder);

  const introLines = wrapIntroTitle(title.title);

  // Which text block the intro phase applies to
  const phaseOpts: Array<{
    text: string;
    delay: number;
    exitOrder: number;
    font: string;
    size: number;
    x: number;
    y: number;
    color: string;
    travel: number;
    shadow: number;
    hide?: boolean;
  }> = [
    { text: "V E O B I B L E", delay: 0.05, exitOrder: 0.04, font: "Avenir", size: 25, x: 116, y: 420, color: palette.gold, travel: 20, shadow: 0.28 },
    { text: introLines[0] ?? "", delay: 0.16, exitOrder: 0, font: "Avenir", size: 42, x: 116, y: 565, color: palette.paper, travel: 30, shadow: 0.28, hide: introLines.length < 3 },
    { text: introLines.length >= 2 ? introLines[1] : introLines[0], delay: 0.3, exitOrder: 0, font: "Georgia Italic", size: 128, x: 108, y: 650, color: palette.gold, travel: 72, shadow: 0.28 },
    { text: introLines.length >= 3 ? introLines[2] : introLines.slice(1).join(" "), delay: 0.5, exitOrder: 0.04, font: "Georgia", size: 48, x: 116, y: 822, color: palette.paper, travel: 42, shadow: 0.28 },
    { text: title.reference, delay: 0.72, exitOrder: 0.13, font: "Georgia", size: 82, x: 112, y: 1060, color: palette.paper, travel: 42, shadow: 0.28 },
    { text: title.version, delay: introVersionDelay, exitOrder: 0.22, font: "Avenir", size: 31, x: 116, y: 1180, color: palette.muted, travel: 42, shadow: 0.28 },
  ];

  const rulePhase = introPhase(0.6, 0.1);
  const ruleAlpha = phaseAlpha(t, rulePhase);

  // Compute base video endTime (clip actual duration vs padded length)


  return (
    <div style={{ width, height, position: "relative", overflow: "hidden", background: "#000" }}>
      {/* Background video clip */}
      <BackgroundVideo
        src={introVideoPath}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        sourceDuration={introDuration}
        muted={voices ? voices.mode !== "mix" : true}
      />

      {/* Optional music from intro clip at 25% when mixing with voice */}
      {voices?.mode === "mix" && introAudioPath && (
        <Audio src={introAudioPath} volume={0.25} endAt={introLength * fps} />
      )}

      {/* Intro voice-over */}
      {voices && voices.mode !== undefined && (
        <Audio src={voices.intro} volume={1} startFrom={0} endAt={introLength * fps} />
      )}

      {/* Vignette + dark scrim */}
      <ScrimOverlay width={width} height={height} t={t} phase={introPhase(0)} maxOpacity={0.35} />

      {/* Gold rule at y=984 */}
      <GoldRule
        x={sx(116)} y={sy(positionY(984))}
        width={sx(108)} height={Math.max(2, sy(3))}
        color={palette.gold}
        t={t}
        phase={rulePhase}
      />

      {/* Text layers */}
      {phaseOpts.map((opt, i) => {
        if (opt.hide) return null;
        const phase = introPhase(opt.delay, opt.exitOrder);
        const alpha = phaseAlpha(t, phase);
        const y = phaseY(t, phase, sy(positionY(opt.y)), sy(opt.travel));
        if (alpha <= 0) return null;
        return (
          <AnimatedText
            key={i}
            text={opt.text}
            x={sx(opt.x)}
            y={y}
            fontSize={Math.max(1, Math.round(opt.size * width / 1080))}
            fontFamily={opt.font}
            color={opt.color}
            alpha={alpha}
            shadow={opt.shadow}
            width={sx(800)}
          />
        );
      })}
    </div>
  );
};
