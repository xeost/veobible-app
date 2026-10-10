import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
const run = promisify(execFile);
export interface VoiceTrim {
  startSeconds: number;
  endSeconds: number;
}

/** Work on a temporary copy so original and shared cached voices remain intact. */
export async function prepareTrimmedVoice(
  file: string,
  trim: VoiceTrim | undefined,
  directory: string,
  part: string,
  binaries: { ffmpegBin: string; ffprobeBin: string },
) {
  if (!trim) return file;
  const { stdout } = await run(binaries.ffprobeBin, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const duration = Number(stdout.trim());
  const end = Math.min(duration, trim.endSeconds);
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    trim.startSeconds < 0 ||
    end - trim.startSeconds < 0.02
  )
    throw new Error(
      "Invalid narration trim; review the selected voice fragment",
    );
  const output = path.join(directory, `${part}-trimmed.wav`);
  await run(
    binaries.ffmpegBin,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-threads",
      "1",
      "-i",
      file,
      "-af",
      `atrim=start=${trim.startSeconds}:end=${end},asetpts=PTS-STARTPTS`,
      "-c:a",
      "pcm_s16le",
      "-y",
      output,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  return output;
}
