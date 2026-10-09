import type { ChapterTrack } from "../../../chapter-introductions";
// Shared prop types for the Remotion VeoBible Short composition.
// These mirror the interfaces already defined in video.ts and verse-timing.ts
// so the remotion bundle does not need to import Node-only modules.

export interface AudioSection {
  file: string;
  /** Reading timeline start, excluding leading scene silence. */
  timelineStart?: number;
  start: number;
  end: number;
}

export interface VerseCue {
  reference: string;
  text: string;
  start: number;
  end: number;
}

export interface IntroTitle {
  episode?: number;
  dayLabel?: string;
  title: string;
  reference: string;
  version: string;
}

export interface OutroSocialRow {
  platform: string;
  handle: string;
}

export interface OutroTitle {
  title: string;
  highlight: string;
  channel: string;
  social: OutroSocialRow[];
  website: string;
}

export interface VoiceTracks {
  intro: string;
  outro: string;
  mode: "voice" | "mix";
}

export type RGB = [number, number, number];

/** Top-level props passed to the VeoBible Short Remotion composition. */
export interface EpisodeCompositionProps {
  /** Duration of the intro segment in seconds. */
  chapterIntroductions?: ChapterTrack[];
  bibleVersionTitle?: string;
  introLength: number;
  /** Actual source video durations, independent of narration length. */
  introVideoDuration: number;
  outroVideoDuration: number;
  /** Duration of the reading segment in seconds (includes leading/trailing silence). */
  readingLength: number;
  /** Duration of the outro segment in seconds. */
  outroLength: number;
  /** Cross-fade duration between segments in seconds. */
  transitionDuration: number;
  /** Silence padding added before/after the Bible reading (in seconds). */
  readingSilence: number;
  readingEndSilence?: number;

  // Asset names relative to the bundle's public directory, resolved with staticFile().
  introVideoPath: string;
  boomerangVideoPath: string;
  outroVideoPath: string;
  /** Bible reading audio sections to concatenate. */
  sections: AudioSection[];
  /** Optional voice-over tracks. */
  voices?: VoiceTracks;
  /** Volume multiplier for the Bible reading audio (1 = original). */
  volumeMultiplier: number;

  // Design data
  introTitle: IntroTitle;
  outroTitle: OutroTitle;
  verseCues: VerseCue[];
  readingPalette: RGB[];
}
