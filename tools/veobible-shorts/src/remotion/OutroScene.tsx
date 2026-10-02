/**
 * OutroScene – React component for the outro segment of a VeoBible Short.
 *
 * Mirrors the `outroGraph` FFmpeg filter chain from motion-design.ts:
 * - Outro video clip (padded if shorter than outroLength)
 * - Dark scrim overlay
 * - VEOBIBLE wordmark
 * - Title (large italic, Georgia Italic)
 * - Highlight text
 * - Channel name
 * - Social platform rows (platform label + handle)
 * - Website
 * - Gold rule
 */

import React from "react";
import { BackgroundVideo } from "./BackgroundVideo";
import { useCurrentFrame, useVideoConfig, Audio } from "remotion";
import {
  stagePhase,
  phaseAlpha,
  phaseY,
  positionY,
} from "./animation";
import type { OutroTitle, VoiceTracks } from "./types";
import { ScrimOverlay } from "./ScrimOverlay";
import { AnimatedText } from "./AnimatedText";
import { GoldRule } from "./GoldRule";

const palette = {
  paper: "#FFF8EA",
  gold: "#E8C68A",
  muted: "#CFD4D0",
  ink: "#101B1C",
};

interface OutroSceneProps {
  outroVideoPath: string;
  outroDuration: number;
  outroLength: number;
  outro: OutroTitle;
  voices?: VoiceTracks;
}

export const OutroScene: React.FC<OutroSceneProps> = ({
  outroVideoPath,
  outroDuration,
  outroLength,
  outro,
  voices,
}) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;

  const sx = (v: number) => Math.round((v * width) / 1080);
  const sy = (v: number) => Math.round((v * height) / 1920);

  const outroPhase = (delay: number, exitOrder = 0) =>
    stagePhase(outroLength, delay, exitOrder);



  // Build text elements
  const fixedElements = [
    { text: "V E O B I B L E", delay: 0.02, exitOrder: 0, font: "Avenir", size: 25, x: 116, y: 320, color: palette.gold, travel: 20 },
    { text: outro.title, delay: 0.16, exitOrder: 0, font: "Georgia Italic", size: 128, x: 108, y: 445, color: palette.gold, travel: 72 },
    { text: outro.highlight, delay: 0.35, exitOrder: 0, font: "Georgia", size: 58, x: 116, y: 605, color: palette.paper, travel: 42 },
    { text: outro.channel, delay: 0.55, exitOrder: 0.06, font: "Avenir", size: 37, x: 116, y: 784, color: palette.paper, travel: 42 },
  ] as const;

  const rulePhase = outroPhase(0.42);

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
      {/* Background outro clip */}
      <BackgroundVideo
        src={outroVideoPath}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        sourceDuration={outroDuration}
        muted={voices ? voices.mode !== "mix" : true}
      />

      {/* Voice-over for outro (with 1-second lead silence baked into Sequence offset) */}
      {voices && (
        <Audio
          src={voices.outro}
          volume={1}
          startFrom={0}
          endAt={outroLength * fps}
        />
      )}

      {/* Scrim overlay */}
      <ScrimOverlay
        width={width}
        height={height}
        t={t}
        phase={outroPhase(0)}
        maxOpacity={0.5}
      />

      {/* Gold rule at y=730 */}
      <GoldRule
        x={sx(116)}
        y={sy(positionY(730))}
        width={sx(108)}
        height={Math.max(2, sy(3))}
        color={palette.gold}
        t={t}
        phase={rulePhase}
      />

      {/* Fixed text elements */}
      {fixedElements.map((opt, i) => {
        const phase = outroPhase(opt.delay, opt.exitOrder);
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
            shadow={0.28}
            width={sx(800)}
          />
        );
      })}

      {/* Social rows */}
      {outro.social.map((row, index) => {
        const y = 910 + index * 114;
        const platformPhase = outroPhase(
          0.7 + index * 0.13,
          (outro.social.length - index) * 0.025,
        );
        const handlePhase = {
          ...platformPhase,
          start: platformPhase.start + 0.05 * Math.min(1, outroLength / 4),
        };
        const pAlpha = phaseAlpha(t, platformPhase);
        const hAlpha = phaseAlpha(t, handlePhase);
        const pY = phaseY(t, platformPhase, sy(positionY(y)), sy(24));
        const hY = phaseY(t, handlePhase, sy(positionY(y + 35)), sy(30));
        return (
          <React.Fragment key={index}>
            {pAlpha > 0 && (
              <AnimatedText
                text={row.platform.toUpperCase()}
                x={sx(116)}
                y={pY}
                fontSize={Math.max(1, Math.round(21 * width / 1080))}
                fontFamily="Avenir"
                color={palette.gold}
                alpha={pAlpha}
                shadow={0.28}
                width={sx(800)}
              />
            )}
            {hAlpha > 0 && (
              <AnimatedText
                text={row.handle}
                x={sx(116)}
                y={hY}
                fontSize={Math.max(1, Math.round(37 * width / 1080))}
                fontFamily="Avenir"
                color={palette.paper}
                alpha={hAlpha}
                shadow={0.28}
                width={sx(800)}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Website */}
      {(() => {
        const wPhase = outroPhase(1.2, 0.18);
        const wAlpha = phaseAlpha(t, wPhase);
        const wY = phaseY(t, wPhase, sy(positionY(1418)), sy(26));
        if (wAlpha <= 0) return null;
        return (
          <AnimatedText
            text={outro.website}
            x={sx(112)}
            y={wY}
            fontSize={Math.max(1, Math.round(54 * width / 1080))}
            fontFamily="Georgia"
            color={palette.gold}
            alpha={wAlpha}
            shadow={0.28}
            width={sx(800)}
          />
        );
      })()}
    </div>
  );
};
