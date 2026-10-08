type PreviewPlayer = { pause(): void; mute(): void };

export function previewDurationInFrames(
  preview: {
    fps: number;
    durationInFrames: number;
    props: { introLength: number; outroLength: number; readingLength: number; transitionDuration?: number };
  },
  section?: "intro" | "outro" | "reading",
) {
  if (!section) {
    if (preview.props.transitionDuration === undefined) return preview.durationInFrames;
    // Recompute after applying the current waveform cuts to the full composition.
    return Math.max(1,
      Math.round(preview.props.introLength * preview.fps) +
      Math.round(preview.props.readingLength * preview.fps) +
      Math.round(preview.props.outroLength * preview.fps) -
      2 * Math.round(preview.props.transitionDuration * preview.fps),
    );
  }
  const length = section === "intro"
    ? preview.props.introLength
    : section === "outro"
      ? preview.props.outroLength
      : preview.props.readingLength;
  // Scene playback must not inherit the complete composition's duration.
  return Math.max(1, Math.round(length * preview.fps));
}
type PreviewMedia = {
  muted: boolean;
  pause(): void;
  removeAttribute(name: string): void;
  load(): void;
};

export function stopPreviewMedia(media: PreviewMedia) {
  media.muted = true;
  media.pause();
  // Clearing the source also cancels pending autoplay and media loading.
  media.removeAttribute("src");
  media.load();
}

export function stopPreviewPlayback(
  player: PreviewPlayer | null,
  media: Iterable<PreviewMedia>,
) {
  player?.pause();
  player?.mute();
  for (const element of media) stopPreviewMedia(element);
}
