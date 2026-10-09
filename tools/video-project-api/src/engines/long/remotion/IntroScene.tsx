/**
 * IntroScene – React component for the intro segment of a VeoBible long-form video.
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
  fitFontSize,
} from "./animation";
import type { IntroTitle, VoiceTracks } from "./types";
import { ScrimOverlay } from "./ScrimOverlay";
import { AnimatedText } from "./AnimatedText";
import { GoldRule } from "./GoldRule";

// ─── design tokens (1920 × 1080 artboard) ────────────────────────────────────
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
  // Frame zero is a fully revealed cover. Only overlay animation is restarted
  // on frame one; the background and narration retain their original timeline.
  const t = Math.max(0, frame - 1) / fps;

  const sx = (v: number) => Math.round((v * width) / 1920);
  const sy = (v: number) => Math.round((v * height) / 1080);

  const introPhase = (delay: number, exitOrder = 0) =>
    frame === 0
      ? {
          start: -1,
          duration: 0.001,
          exit: introLength + 1,
          exitDuration: 0.45,
        }
      : stagePhase(introLength, delay, exitOrder);

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
    {
      text: "V E O B I B L E",
      delay: 0.05,
      exitOrder: 0.04,
      font: "Avenir",
      size: 25,
      x: 160,
      y: 140,
      color: palette.gold,
      travel: 20,
      shadow: 0.28,
    },
    {
      text: introLines[0] ?? "",
      delay: 0.16,
      exitOrder: 0,
      font: "Avenir",
      size: 42,
      x: 160,
      y: 245,
      color: palette.paper,
      travel: 30,
      shadow: 0.28,
      hide: introLines.length < 3,
    },
    {
      text: introLines.length >= 2 ? introLines[1] : introLines[0],
      delay: 0.3,
      exitOrder: 0,
      font: "Georgia Italic",
      size: 128,
      x: 152,
      y: 310,
      color: palette.gold,
      travel: 72,
      shadow: 0.28,
    },
    {
      text:
        introLines.length >= 3 ? introLines[2] : introLines.slice(1).join(" "),
      delay: 0.5,
      exitOrder: 0.04,
      font: "Georgia",
      size: 48,
      x: 160,
      y: 470,
      color: palette.paper,
      travel: 42,
      shadow: 0.28,
    },
    {
      text: title.reference,
      delay: 0.72,
      exitOrder: 0.13,
      font: "Georgia",
      size: 58,
      x: 160,
      y: 650,
      color: palette.paper,
      travel: 42,
      shadow: 0.28,
    },
    {
      text: title.version,
      delay: introVersionDelay,
      exitOrder: 0.22,
      font: "Avenir",
      size: 31,
      x: 160,
      y: 750,
      color: palette.muted,
      travel: 42,
      shadow: 0.28,
    },
  ];

  const dayPhase = introPhase(0.35, 0.1);
  const dayAlpha = phaseAlpha(t, dayPhase);
  const rulePhase = introPhase(0.6, 0.1);
  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Background video clip */}
      <BackgroundVideo
        src={introVideoPath}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        sourceDuration={introDuration}
        muted={voices ? voices.mode !== "mix" : true}
      />

      {/* Optional music from intro clip at 25% when mixing with voice */}
      {voices?.mode === "mix" && introAudioPath && (
        <Audio
          src={introAudioPath}
          useWebAudioApi
          crossOrigin="anonymous"
          volume={0.25}
          endAt={introLength * fps}
        />
      )}

      {/* Intro voice-over */}
      {voices && voices.mode !== undefined && (
        <Audio
          src={voices.intro}
          // Shared audio elements must keep the same output route after passage reading.
          useWebAudioApi
          crossOrigin="anonymous"
          volume={1}
          startFrom={0}
          endAt={introLength * fps}
        />
      )}

      {/* Vignette + dark scrim */}
      <ScrimOverlay
        width={width}
        height={height}
        t={t}
        phase={introPhase(0)}
        maxOpacity={0.35}
      />

      {/* The cover frame shows the complete day badge for thumbnail readability. */}
      {title.episode && dayAlpha > 0 && (
        <div
          style={{
            position: "absolute",
            left: sx(1300),
            top: phaseY(t, dayPhase, sy(195), sy(30)),
            width: sx(480),
            height: sy(610),
            opacity: dayAlpha,
          }}
        >
          {/* Translucent paper and layered bottom edges suggest a tear-off calendar. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              borderRadius: sx(14),
              background:
                "linear-gradient(145deg, rgba(255, 251, 239, 0.84), rgba(243, 237, 218, 0.72))",
              border: `${sx(1)}px solid rgba(255, 252, 238, 0.6)`,
              boxShadow: `0 ${sy(8)}px 0 ${sx(-2)}px rgba(226, 219, 198, 0.65), 0 ${sy(15)}px 0 ${sx(-5)}px rgba(207, 199, 177, 0.5), 0 ${sy(28)}px ${sx(65)}px rgba(0, 0, 0, 0.3)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: `repeating-linear-gradient(0deg, transparent 0 ${sy(3)}px, rgba(92, 75, 45, 0.025) ${sy(3)}px ${sy(4)}px)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "0 0 auto",
                height: sy(155),
                background:
                  "linear-gradient(140deg, rgba(45, 77, 61, 0.88), rgba(26, 54, 43, 0.84))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: sy(16),
                boxSizing: "border-box",
                borderBottom: `${sy(2)}px dashed rgba(90, 75, 48, 0.45)`,
                fontFamily: "Avenir, sans-serif",
                fontSize: sx(68),
                fontWeight: 800,
                letterSpacing: sx(10),
                textTransform: "uppercase",
                color: palette.paper,
                textIndent: sx(10),
              }}
            >
              {title.dayLabel ?? "Day"}
            </div>
            <div
              style={{
                position: "absolute",
                top: sy(155),
                left: 0,
                right: 0,
                bottom: sy(12),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#203C30",
                fontFamily: "Georgia, serif",
                fontSize: sx(fitFontSize(String(title.episode), 360, 400)),
                fontWeight: 400,
                lineHeight: 1,
                letterSpacing: sx(-8),
                paddingRight: sx(8),
                fontVariantNumeric: "lining-nums tabular-nums",
              }}
            >
              {title.episode}
            </div>
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: sx(42),
                height: sy(42),
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                background:
                  "linear-gradient(135deg, rgba(154, 141, 109, 0.08), rgba(255, 253, 245, 0.85))",
              }}
            />
          </div>
          {[105, 375].map((x) => (
            <React.Fragment key={x}>
              <div
                style={{
                  position: "absolute",
                  left: sx(x - 16),
                  top: sy(26),
                  width: sx(32),
                  height: sy(16),
                  borderRadius: "50%",
                  background: "rgba(8, 24, 17, 0.7)",
                  boxShadow: `0 ${sy(2)}px ${sy(3)}px rgba(255, 255, 255, 0.15)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: sx(x - 7),
                  top: sy(-22),
                  width: sx(14),
                  height: sy(62),
                  borderRadius: sx(7),
                  background:
                    "linear-gradient(90deg, #746449, #DFD0AC 45%, #AA9470 70%, #65543B)",
                  boxShadow: `${sx(3)}px ${sy(4)}px ${sx(5)}px rgba(0, 0, 0, 0.25)`,
                }}
              />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Gold rule at y=984 */}
      <GoldRule
        x={sx(160)}
        y={sy(positionY(605))}
        width={sx(108)}
        height={Math.max(2, sy(3))}
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
            fontSize={Math.max(1, Math.round((opt.size * width) / 1920))}
            fontFamily={opt.font}
            color={opt.color}
            alpha={alpha}
            shadow={opt.shadow}
            width={sx(title.episode ? 1100 : 1600)}
          />
        );
      })}
    </div>
  );
};
