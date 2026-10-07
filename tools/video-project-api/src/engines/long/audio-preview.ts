import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import type { AudioSection } from "./video.js";
import { validateReadingVolume } from "./reading-audio.js";
const execFileAsync = promisify(execFile);
/** Render the exact adjusted cut, including passages spanning several chapters. */
export async function renderAudioPreview(
  output: string,
  sections: AudioSection[],
  volume = 1,
  options: { padSections?: boolean } = {},
): Promise<void> {
  validateReadingVolume(volume);
  if (
    !sections.length ||
    sections.some(
      (section) =>
        section.start < 0 ||
        section.end <= section.start ||
        !Number.isFinite(section.start + section.end),
    )
  )
    throw new Error("Invalid audio preview cut");
  // Container durations can include MP3 encoder padding. Keep chapter joins at
  // their advertised coordinates when building a source buffer for live edits.
  const filters = sections.map(
    (section, index) =>
      `[${index}:a]atrim=start=${section.start.toFixed(6)}:end=${section.end.toFixed(6)},asetpts=PTS-STARTPTS${options.padSections ? `,apad=whole_dur=${(section.end - section.start).toFixed(6)}` : ""},aresample=48000,aformat=channel_layouts=stereo[p${index}]`,
  );
  filters.push(
    sections.length === 1
      ? "[p0]anull[joined]"
      : `${sections.map((_, index) => `[p${index}]`).join("")}concat=n=${sections.length}:v=0:a=1[joined]`,
  );
  filters.push(
    `[joined]volume=${volume}${volume > 1 ? ",alimiter=limit=0.95:level=0:latency=1" : ""}[audio]`,
  );
  await execFileAsync(
    config.ffmpegBin,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      ...sections.flatMap((section) => ["-i", section.file]),
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[audio]",
      "-c:a",
      "pcm_s24le",
      "-y",
      output,
    ],
    { maxBuffer: 1024 * 1024 },
  );
}
