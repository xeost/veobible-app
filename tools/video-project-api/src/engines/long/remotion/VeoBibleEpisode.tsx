/**
 * VeoBibleEpisode – root Remotion composition.
 *
 * Structure mirrors the FFmpeg xfade/acrossfade timeline:
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ intro (introLength s)                                     │
 *   │              ┌───────────────────────────────────────────┐│
 *   │              │ reading (readingLength s)                  ││
 *   │              │              ┌────────────────────────────┤│
 *   │              │              │ outro (outroLength s)       ││
 *   └──────────────┴──────────────┴────────────────────────────┘│
 *                  ↑ fade         ↑ fade                        │
 *              (transitionDuration s each)                       │
 *
 * Each cross-fade is implemented as a CSS opacity cross-dissolve using two
 * overlapping `<Sequence>` blocks. This is the cleanest equivalent to FFmpeg's
 * `xfade=transition=fade`.
 *
 * Total duration = introLength + readingLength + outroLength
 *                  - transitionDuration * 2   (frames saved by overlap)
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { IntroScene } from "./IntroScene";
import { ReadingScene } from "./ReadingScene";
import { OutroScene } from "./OutroScene";
import type { EpisodeCompositionProps } from "./types";

const resolveAsset = (source: string) =>
  /^(?:https?:\/\/|\/)/.test(source) ? source : staticFile(source);

// Fade opacity helpers --------------------------------------------------------
const fadeIn = (frame: number, fps: number, durationSec: number): number =>
  Math.min(1, frame / Math.max(1, Math.round(durationSec * fps)));

const fadeOut = (
  frame: number,
  totalFrames: number,
  fps: number,
  durationSec: number,
): number =>
  Math.min(
    1,
    (totalFrames - frame) / Math.max(1, Math.round(durationSec * fps)),
  );

interface FadeWrapperProps {
  from: "intro" | "reading" | "outro";
  fadeDuration: number;
  children: React.ReactNode;
  totalFrames: number;
}
const FadeWrapper: React.FC<FadeWrapperProps> = ({
  from,
  fadeDuration,
  children,
  totalFrames,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  // Dissolve only between stages, never from/to black at the video edges.
  const fi = from === "intro" ? 1 : fadeIn(frame, fps, fadeDuration);
  const fo =
    from === "outro" ? 1 : fadeOut(frame, totalFrames, fps, fadeDuration);
  return (
    <AbsoluteFill style={{ opacity: Math.min(fi, fo) }}>
      {children}
    </AbsoluteFill>
  );
};

// ─── Main composition ─────────────────────────────────────────────────────────

export const VeoBibleEpisode: React.FC<EpisodeCompositionProps> = (props) => {
  const {
    introLength,
    introVideoDuration,
    outroVideoDuration,
    readingLength,
    outroLength,
    transitionDuration,
    readingSilence,
    introVideoPath,
    boomerangVideoPath,
    outroVideoPath,
    sections,
    voices,
    volumeMultiplier,
    introTitle,
    outroTitle,
    verseCues,
    readingPalette,
  } = {
    ...props,
    introVideoPath: props.introVideoPath
      ? resolveAsset(props.introVideoPath)
      : "",
    boomerangVideoPath: props.boomerangVideoPath
      ? resolveAsset(props.boomerangVideoPath)
      : "",
    outroVideoPath: props.outroVideoPath
      ? resolveAsset(props.outroVideoPath)
      : "",
    sections: props.sections.map((section) => ({
      ...section,
      file: resolveAsset(section.file),
    })),
    voices: props.voices
      ? {
          ...props.voices,
          intro: resolveAsset(props.voices.intro),
          outro: resolveAsset(props.voices.outro),
        }
      : undefined,
  };

  const { fps } = useVideoConfig();

  // Derived durations (in frames)
  const introFrames = Math.round(introLength * fps);
  const readingFrames = Math.round(readingLength * fps);
  const outroFrames = Math.round(outroLength * fps);
  const transFrames = Math.round(transitionDuration * fps);

  // Segment start offsets (in frames) — matching xfade offsets
  const introStart = 0;
  const readingStart = introFrames - transFrames;
  const outroStart = readingStart + readingFrames - transFrames;

  // Reading audio sum
  const readingDuration = sections.reduce((sum, s) => sum + s.end - s.start, 0);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* ── INTRO ─────────────────────────────────────────────────── */}
      <Sequence from={introStart} durationInFrames={introFrames}>
        <FadeWrapper
          from="intro"
          fadeDuration={transitionDuration}
          totalFrames={introFrames}
        >
          <IntroScene
            introVideoPath={introVideoPath}
            introDuration={introVideoDuration}
            introLength={introLength}
            title={introTitle}
            voices={voices}
          />
        </FadeWrapper>
      </Sequence>

      {/* ── READING ───────────────────────────────────────────────── */}
      <Sequence from={readingStart} durationInFrames={readingFrames}>
        <FadeWrapper
          from="reading"
          fadeDuration={transitionDuration}
          totalFrames={readingFrames}
        >
          <ReadingScene
            boomerangVideoPath={boomerangVideoPath}
            sections={sections}
            voices={voices}
            volumeMultiplier={volumeMultiplier}
            verseCues={verseCues}
            readingLength={readingLength}
            readingSilence={readingSilence}
            readingPalette={readingPalette}
            readingDuration={readingDuration}
          />
        </FadeWrapper>
      </Sequence>

      {/* ── OUTRO ─────────────────────────────────────────────────── */}
      <Sequence from={outroStart} durationInFrames={outroFrames}>
        <FadeWrapper
          from="outro"
          fadeDuration={transitionDuration}
          totalFrames={outroFrames}
        >
          <OutroScene
            outroVideoPath={outroVideoPath}
            outroDuration={outroVideoDuration}
            outroLength={outroLength}
            outro={outroTitle}
            voices={voices}
          />
        </FadeWrapper>
      </Sequence>
    </AbsoluteFill>
  );
};
