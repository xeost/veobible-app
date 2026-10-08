/** Normalize a clip and append its reversed frames; clip audio remains in its original direction. */
export async function createBoomerang(
  source: string,
  output: string,
  options: {
    width: number;
    height: number;
    frameRate: string;
    preserveAudio?: boolean;
    /** Exclude a baked-in closing fade from the picture without trimming audio. */
    videoEndSeconds?: number;
  },
  run: (args: string[]) => Promise<void>,
) {
  const trim = options.videoEndSeconds === undefined ? "" : `trim=end=${options.videoEndSeconds},setpts=PTS-STARTPTS,`;
  const picture = `[0:v:0]${trim}fps=${options.frameRate},scale=${options.width}:${options.height}:force_original_aspect_ratio=increase,crop=${options.width}:${options.height},format=yuv420p`;
  await run([
    "-i",
    source,
    "-filter_complex",
    `${picture},split[forward][backward];[forward]setpts=PTS-STARTPTS[f];[backward]reverse,setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1:a=0[v]`,
    "-map",
    "[v]",
    ...(options.preserveAudio ? ["-map", "0:a?", "-c:a", "copy"] : ["-an"]),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    output,
  ]);
}
