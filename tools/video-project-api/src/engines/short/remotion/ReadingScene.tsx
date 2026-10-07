/**
 * ReadingScene – the "reading" segment of the VeoBible Short.
 *
 * Mirrors the `readingGraph` FFmpeg filter chain:
 * - Boomerang (looping) background video
 * - Chromatic color overlay (drifting palette sampled from the background)
 * - Verse reference, open-quote glyph, verse lines (staggered entrance)
 * - Gold rule
 * - Website wordmark at bottom
 * - Bible reading audio (concatenated sections, volume-adjusted)
 * - Optional voice tracks
 */

import React from "react";
import { Video } from "@remotion/media";
import { useCurrentFrame, useVideoConfig, Audio } from "remotion";
import {
  stagePhase,
  layoutVerse,
  verseTextPhases,
  phaseAlpha,
  phaseY,
  positionY,
} from "./animation";
import type { VerseCue, AudioSection, VoiceTracks, RGB } from "./types";
import { ChromaticBackground } from "./ChromaticBackground";
import { AnimatedText } from "./AnimatedText";
import { GoldRule } from "./GoldRule";

const readingInk = { body: "#182320", accent: "#493A29" };
const DEFAULT_PALETTE: RGB[] = [
  [246, 236, 216],
  [222, 236, 226],
  [240, 224, 210],
  [220, 232, 242],
];

interface ReadingSceneProps {
  boomerangVideoPath: string;
  sections: AudioSection[];
  voices?: VoiceTracks;
  volumeMultiplier: number;
  verseCues: VerseCue[];
  readingLength: number;
  readingSilence: number;
  readingPalette?: RGB[];
  /** Total reading duration (sum of section cuts, without silence padding). */
  readingDuration: number;
}

export const ReadingScene: React.FC<ReadingSceneProps> = ({
  boomerangVideoPath,
  sections,
  voices,
  volumeMultiplier,
  verseCues,
  readingLength,
  readingSilence,
  readingPalette,
  readingDuration,
}) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;

  const sx = (v: number) => Math.round((v * width) / 1080);
  const sy = (v: number) => Math.round((v * height) / 1920);

  const readingPhase = {
    start: Math.max(0, readingSilence - 0.3),
    duration: 0.45,
    exit: readingLength - readingSilence,
    exitDuration: 0.4,
  };

  const colors =
    readingPalette && readingPalette.length >= 4
      ? readingPalette
      : DEFAULT_PALETTE;

  const layouts = verseCues.map((cue) => layoutVerse(cue.text));
  const lineCounts = layouts.map((l) => l.lines.length);

  // Build audio offset list so we can schedule each section's Audio correctly.
  // Section audio starts at readingSilence seconds into this segment.
  let sectionOffset = readingSilence;
  const sectionSchedule = sections.map((section) => {
    const start = sectionOffset;
    const dur = section.end - section.start;
    sectionOffset += dur;
    return { ...section, scheduleStart: start };
  });

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: "#F6ECE0",
      }}
    >
      {/* Looping boomerang video (no audio) */}
      <Video
        src={boomerangVideoPath}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
        objectFit="cover"
        loop
        muted
      />

      {/* Chromatic color overlay */}
      <ChromaticBackground
        width={width}
        height={height}
        t={t}
        colors={colors}
        phase={readingPhase}
      />

      {/* Bible reading audio sections */}
      {sectionSchedule.map((section, i) => (
        <Audio
          key={i}
          src={section.file}
          startFrom={Math.round(section.start * fps)}
          endAt={Math.round(section.end * fps)}
          // Delay into this segment: scheduleStart frames from the start of the reading scene
          // Remotion offsets are controlled via Sequence wrapper in the root composition.
          volume={
            volumeMultiplier > 1
              ? Math.min(volumeMultiplier, 4)
              : volumeMultiplier
          }
        />
      ))}

      {/* Voice-over for reading segment if voices provided */}
      {voices && voices.mode === "mix" && (
        <Audio src={voices.intro} volume={0.25} />
      )}

      {/* Gold rule at y=551 */}
      <GoldRule
        x={sx(116)}
        y={sy(positionY(551))}
        width={sx(96)}
        height={Math.max(2, sy(3))}
        color={readingInk.accent}
        t={t}
        phase={readingPhase}
      />

      {/* Verse text layers */}
      {verseCues.map((cue, cueIndex) => {
        const layout = layouts[cueIndex];
        const lineHeight = layout.fontSize * 1.28;
        const top = 695 + (720 - layout.lines.length * lineHeight) / 2;
        const phases = verseTextPhases(
          verseCues,
          lineCounts,
          cueIndex,
          readingSilence,
        );

        // Reference text (phases[0])
        const refPhase = phases[0];
        const refAlpha = phaseAlpha(t, refPhase);
        const refY = phaseY(t, refPhase, sy(positionY(476)), sy(24));

        // Open-quote glyph (phases[1])
        const quotePhase = phases[1];
        const quoteAlpha = phaseAlpha(t, quotePhase);
        const quoteY = phaseY(t, quotePhase, sy(positionY(619)), sy(20));

        return (
          <React.Fragment key={cueIndex}>
            {refAlpha > 0 && (
              <AnimatedText
                text={cue.reference}
                x={sx(116)}
                y={refY}
                fontSize={Math.max(1, Math.round((36 * width) / 1080))}
                fontFamily="Avenir"
                color={readingInk.accent}
                alpha={refAlpha}
                shadow={0}
                width={sx(800)}
              />
            )}
            {quoteAlpha > 0 && (
              <AnimatedText
                text={"\u201C"}
                x={sx(106)}
                y={quoteY}
                fontSize={Math.max(1, Math.round((106 * width) / 1080))}
                fontFamily="Georgia"
                color={readingInk.accent}
                alpha={quoteAlpha}
                shadow={0}
                width={sx(800)}
              />
            )}
            {layout.lines.map((line, lineIndex) => {
              const linePhase = phases[lineIndex + 2];
              if (!linePhase) return null;
              const lineAlpha = phaseAlpha(t, linePhase);
              if (lineAlpha <= 0) return null;
              const lineY = phaseY(
                t,
                linePhase,
                sy(positionY(top + lineIndex * lineHeight)),
                sy(34),
              );
              return (
                <AnimatedText
                  key={lineIndex}
                  text={line}
                  x={sx(116)}
                  y={lineY}
                  fontSize={Math.max(
                    1,
                    Math.round((layout.fontSize * width) / 1080),
                  )}
                  fontFamily="Georgia"
                  color={readingInk.body}
                  alpha={lineAlpha}
                  shadow={0}
                  width={sx(800)}
                />
              );
            })}
          </React.Fragment>
        );
      })}

      {/* Website wordmark */}
      {(() => {
        const wAlpha = phaseAlpha(t, readingPhase);
        const wY = phaseY(t, readingPhase, sy(positionY(1510)), sy(10));
        if (wAlpha <= 0) return null;
        return (
          <AnimatedText
            text="V E O B I B L E . C O M"
            x={sx(116)}
            y={wY}
            fontSize={Math.max(1, Math.round((24 * width) / 1080))}
            fontFamily="Avenir Next Demi Bold"
            color={readingInk.body}
            alpha={wAlpha}
            shadow={0}
            width={sx(800)}
          />
        );
      })()}
    </div>
  );
};
