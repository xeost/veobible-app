type ReadingPlayer = Pick<
  HTMLMediaElement,
  "defaultPlaybackRate" | "playbackRate" | "preservesPitch"
>;

export function applyReadingPlaybackSpeed(
  player: ReadingPlayer,
  speed: number,
  restart = false,
) {
  // Media loading resets playbackRate to defaultPlaybackRate. Keep both in sync.
  player.defaultPlaybackRate = speed;
  player.preservesPitch = true;
  // Some media engines retain the exposed rate after a seek but reset actual playback.
  // Reapply a distinct rate once seeking/starting has completed to refresh the engine.
  if (restart && speed !== 1) player.playbackRate = 1;
  player.playbackRate = speed;
}
