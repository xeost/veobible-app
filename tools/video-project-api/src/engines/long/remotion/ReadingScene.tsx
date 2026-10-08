import type { ChapterTrack } from "../../../chapter-introductions";
/** Editorial reading card shared by episode previews and final rendering. */
import React, { useMemo } from "react";
import { Video } from "@remotion/media";
import { useCurrentFrame, useVideoConfig, Audio, Sequence } from "remotion";
import { layoutVerse, verseTextPhases, phaseAlpha, phaseY } from "./animation";
import type { VerseCue, AudioSection, VoiceTracks, RGB } from "./types";
import { AnimatedText } from "./AnimatedText";

const paper = {
  width: 1488,
  height: 740,
  padding: 100,
  textWidth: 1288,
  body: "#243A32",
  accent: "#997B48",
};

interface ReadingSceneProps {
  chapterIntroductions?: ChapterTrack[];
  bibleVersionTitle?: string;
  boomerangVideoPath: string;
  sections: AudioSection[];
  voices?: VoiceTracks;
  volumeMultiplier: number;
  verseCues: VerseCue[];
  readingLength: number;
  readingSilence: number;
  readingPalette?: RGB[];
  /** Reading duration includes pauses between the independently trimmed verses. */
  readingDuration: number;
}

export const ReadingScene: React.FC<ReadingSceneProps> = ({
  boomerangVideoPath,
  chapterIntroductions = [],
  bibleVersionTitle = "",
  sections,
  volumeMultiplier,
  verseCues,
  readingSilence,
  readingDuration,
}) => {
  const { fps, width, height } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const sx = (value: number) => (value * width) / 1920;
  const sy = (value: number) => (value * height) / 1080;
  const layouts = useMemo(
    () => verseCues.map((cue) => layoutVerse(cue.text)),
    [verseCues],
  );
  const lineCounts = useMemo(
    () => layouts.map((layout) => layout.lines.length),
    [layouts],
  );
  const progress = Math.max(
    0,
    Math.min(1, (t - readingSilence) / Math.max(0.001, readingDuration)),
  );

  // Schedule independent source cuts without including the surrounding waveform context.
  let sectionOffset = readingSilence;
  const sectionSchedule = sections.map((section) => {
    const start =
      readingSilence +
      (section.timelineStart ?? sectionOffset - readingSilence);
    sectionOffset = start + section.end - section.start;
    return { ...section, scheduleStart: start };
  });

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: "#17251F",
      }}
    >
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
      {chapterIntroductions.map((chapter) => (
        <Sequence
          key={chapter.part}
          from={Math.round((readingSilence + chapter.start + 0.35) * fps)}
          durationInFrames={Math.max(1, Math.ceil(chapter.duration * fps))}
          layout="none"
        >
          <Audio
            src={chapter.file}
            useWebAudioApi
            crossOrigin="anonymous"
            volume={1}
          />
        </Sequence>
      ))}
      {sectionSchedule.map((section, index) => (
        <Sequence
          key={index}
          from={Math.round(section.scheduleStart * fps)}
          durationInFrames={Math.max(
            1,
            Math.ceil((section.end - section.start) * fps),
          )}
          layout="none"
        >
          <Audio
            src={section.file}
            useWebAudioApi
            crossOrigin="anonymous"
            trimBefore={section.start * fps}
            trimAfter={section.end * fps}
            volume={Math.min(volumeMultiplier, 4)}
          />
        </Sequence>
      ))}

      {/* The paper stays still and visible; only the text changes between verses. */}
      <div
        style={{
          position: "absolute",
          left: (width - sx(paper.width)) / 2,
          top: (height - sy(paper.height)) / 2,
          width: sx(paper.width),
          height: sy(paper.height),
          borderRadius: sx(22),
          background:
            "linear-gradient(145deg, rgba(255, 253, 247, 0.87), rgba(250, 247, 239, 0.81))",
          backdropFilter: `blur(${sx(14)}px) saturate(0.8)`,
          WebkitBackdropFilter: `blur(${sx(14)}px) saturate(0.8)`,
          boxShadow: `0 ${sy(24)}px ${sx(80)}px rgba(9, 23, 16, 0.23), inset 0 0 0 1px rgba(255, 255, 255, 0.7)`,
          overflow: "hidden",
        }}
      >
        {chapterIntroductions.map((chapter) => {
          const local = t - readingSilence - chapter.start;
          const length = chapter.duration + 1;
          if (local < 0 || local >= length) return null;
          const alpha = Math.max(
            0,
            Math.min(1, local / 0.3, (length - local) / 0.3),
          );
          return (
            <div
              key={chapter.part}
              style={{
                position: "absolute",
                inset: `${sy(54)}px ${sx(paper.padding)}px ${sy(126)}px`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                opacity: alpha,
              }}
            >
              <div
                style={{
                  color: paper.accent,
                  fontFamily: "Avenir, sans-serif",
                  fontSize: sx(28),
                  letterSpacing: sx(3),
                  marginBottom: sy(28),
                }}
              >
                {chapter.bookName}
              </div>
              <div
                style={{
                  color: paper.body,
                  fontFamily: "Georgia, serif",
                  fontSize: sx(100),
                  lineHeight: 1.25,
                }}
              >
                {chapter.title.split(" · ")[0]}
              </div>
              {chapter.title.includes(" · ") && (
                <div
                  style={{
                    color: paper.accent,
                    fontFamily: "Georgia, serif",
                    fontSize: sx(44),
                    marginTop: sy(24),
                  }}
                >
                  {chapter.title.split(" · ")[1]}
                </div>
              )}
            </div>
          );
        })}
        {verseCues.map((cue, cueIndex) => {
          if (
            t < cue.start + readingSilence - 2 ||
            t > cue.end + readingSilence + 1
          )
            return null;
          const phases = verseTextPhases(
            verseCues,
            lineCounts,
            cueIndex,
            readingSilence,
          );
          const layout = layouts[cueIndex];
          const lineHeight = layout.fontSize * 1.38;
          // Keep reference and verse together, optically centered above the quiet footer.
          const groupHeight = 66 + layout.lines.length * lineHeight;
          const groupTop = 54 + (560 - groupHeight) / 2;
          const referencePhase = phases[0];
          const referenceAlpha = phaseAlpha(t, referencePhase);
          const referenceY = phaseY(
            t,
            referencePhase,
            sy(groupTop),
            sy(10),
            sy(5),
          );
          return (
            <React.Fragment key={cue.reference}>
              {referenceAlpha > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: sx(paper.padding),
                    top: referenceY,
                    display: "flex",
                    alignItems: "center",
                    gap: sx(22),
                    opacity: referenceAlpha,
                    maxWidth: sx(paper.textWidth),
                    color: paper.accent,
                    fontFamily: "Avenir, sans-serif",
                    fontSize: sx(29),
                    fontWeight: 500,
                    letterSpacing: sx(1.4),
                    lineHeight: 1.3,
                  }}
                >
                  <span
                    style={{
                      width: sx(52),
                      height: sy(2),
                      background: paper.accent,
                      flexShrink: 0,
                    }}
                  />
                  <span>{cue.reference}</span>
                </div>
              )}
              {layout.lines.map((line, lineIndex) => {
                const phase = phases[lineIndex + 2];
                const alpha = phaseAlpha(t, phase);
                if (alpha <= 0) return null;
                return (
                  <AnimatedText
                    key={lineIndex}
                    text={line}
                    x={sx(paper.padding)}
                    y={phaseY(
                      t,
                      phase,
                      sy(groupTop + 66 + lineIndex * lineHeight),
                      sy(12),
                      sy(6),
                    )}
                    fontSize={sx(layout.fontSize)}
                    fontFamily="Georgia"
                    color={paper.body}
                    alpha={alpha}
                    shadow={0}
                    width={sx(paper.textWidth)}
                    lineHeight={1.38}
                  />
                );
              })}
            </React.Fragment>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: sx(paper.padding),
            right: sx(paper.padding),
            bottom: sy(98),
            height: sy(1),
            background: "rgba(121, 103, 72, 0.14)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: sx(paper.padding),
            right: sx(paper.padding),
            bottom: sy(45),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: sx(40),
            fontFamily: "Avenir, sans-serif",
            fontSize: sx(20),
            fontWeight: 500,
            color: "rgba(36, 58, 50, 0.58)",
          }}
        >
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: sx(1.2),
            }}
          >
            {bibleVersionTitle}
          </span>
          <span
            style={{
              flexShrink: 0,
              letterSpacing: sx(4.5),
              textAlign: "right",
            }}
          >
            VEOBIBLE.COM
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            inset: "auto 0 0",
            height: sy(3),
            background: "rgba(153, 123, 72, 0.1)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "rgba(153, 123, 72, 0.65)",
              transform: `scaleX(${progress})`,
              transformOrigin: "left center",
            }}
          />
        </div>
      </div>
    </div>
  );
};
