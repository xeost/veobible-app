/** Shared by browser previews and both final render formats. */
export const READING_END_SILENCE = 1.5;
export const OUTRO_NARRATION_DELAY = 0.75;
export const LONG_OUTRO_END_SILENCE = 7;

export function readingPadding(props: {
  readingSilence: number;
  readingEndSilence?: number;
}) {
  return (
    props.readingSilence + (props.readingEndSilence ?? props.readingSilence)
  );
}
