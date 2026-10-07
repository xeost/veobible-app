type PreviewPlayer = { pause(): void; mute(): void };
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
