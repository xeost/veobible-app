/**
 * video.ts – Remotion-based replacement for the previous FFmpeg-only renderer.
 *
 * Public API is IDENTICAL to the original so that shorts.ts, index.ts and all
 * other callers require zero changes.  The only difference is that video
 * composition and rendering now go through Remotion instead of a raw FFmpeg
 * filter graph.  FFmpeg is still used for:
 *   - audio duration measurement (audioDurationSeconds via ffprobe)
 *   - silence detection for verse-timing (detectPauses in verse-timing.ts)
 *   - background palette extraction (extractBackgroundPalette via rawvideo)
 *   - boomerang construction (forward+reverse loop from the background clip)
 *   - thumbnail extraction from the rendered video
 */

import fs from "node:fs/promises";
import path from "node:path";
import { availableParallelism } from "node:os";
import { randomInt } from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { config } from "./config.js";
import type { VerseCue } from "./verse-timing.js";
import { introAnimationEnd } from "./remotion/animation.js";
import { extractBackgroundPalette } from "./background-palette.js";
import { validateReadingVolume } from "./reading-audio.js";
import type { ShortCompositionProps } from "./remotion/types.js";
import { prepareRemotionMedia } from "./remotion-media.js";
export { layoutVerse } from "./remotion/animation.js";
import { wrapIntroTitle as wrapIntroTitleArr } from "./remotion/animation.js";
/** Returns the wrapped intro title as a newline-joined string (same API as the original). */
export function wrapIntroTitle(title: string): string {
  return wrapIntroTitleArr(title).join("\n");
}


const execFileAsync = promisify(execFile);

// ─── types (re-exported for callers) ─────────────────────────────────────────
export interface AudioSection { file: string; start: number; end: number }
export interface VideoResult { background: string; duration: number; readingDuration: number; thumbnailTime: number }
export interface VoiceTracks { intro: string; outro: string; mode: "voice" | "mix" }
export interface IntroTitle { title: string; reference: string; version: string }
export interface OutroTitle { title: string; highlight: string; channel: string; social: Array<{ platform: string; handle: string }>; website: string }

// ─── helpers ─────────────────────────────────────────────────────────────────

interface MediaInfo {
  streams: Array<{ codec_type: string; width?: number; height?: number; r_frame_rate?: string; duration?: string }>;
  format: { duration?: string };
}

async function mediaInfo(file: string): Promise<MediaInfo> {
  const { stdout } = await execFileAsync(config.ffprobeBin, ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,duration:format=duration", "-of", "json", file]);
  return JSON.parse(stdout) as MediaInfo;
}

async function ffmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", ...args], { maxBuffer: 1024 * 1024 });
  } catch (error) {
    throw new Error(`FFmpeg failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function mediaDuration(info: MediaInfo, file: string): number {
  const videoDuration = Number(info.streams.find(s => s.codec_type === "video")?.duration);
  const value = Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : Number(info.format.duration);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid video duration: ${file}`);
  return value;
}

function audioStreamDuration(info: MediaInfo, file: string): number {
  const value = Number(info.streams.find(s => s.codec_type === "audio")?.duration);
  return Number.isFinite(value) && value > 0 ? value : mediaDuration(info, file);
}

function requireClipStreams(info: MediaInfo, file: string, needsAudio: boolean): void {
  if (!info.streams.some(s => s.codec_type === "video")) throw new Error(`Missing video stream: ${file}`);
  if (needsAudio && !info.streams.some(s => s.codec_type === "audio")) throw new Error(`Missing audio stream: ${file}`);
}

/** Select only numbered background clips, independently of directory order. */
export async function backgroundVideos(videosDir: string): Promise<string[]> {
  const entries = await fs.readdir(videosDir, { withFileTypes: true });
  const files = entries.filter(e => e.isFile() && /^bg-\d+\.mp4$/.test(e.name)).map(e => path.join(videosDir, e.name)).sort();
  if (!files.length) throw new Error(`No bg-[number].mp4 videos found in ${videosDir}`);
  return files;
}

function pictureFilter(input: number, width: number, height: number, frameRate: string): string {
  return `[${input}:v:0]fps=${frameRate},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p`;
}

export function introThumbnailTime(length: number, frameRate: string): number {
  const [numerator, denominator] = frameRate.split("/").map(Number);
  const rate = numerator / denominator;
  return (Math.floor(introAnimationEnd(length) * rate) + 1) / rate;
}

export async function generateThumbnail(video: string, output: string, at: number): Promise<void> {
  console.log("Creating publication thumbnail...");
  const info = await mediaInfo(video);
  const rate = info.streams.find(s => s.codec_type === "video")?.r_frame_rate;
  if (!rate) throw new Error(`Missing video frame rate: ${video}`);
  const [numerator, denominator] = rate.split("/").map(Number);
  const frame = Math.round(at * numerator / denominator);
  await ffmpeg(["-i", video, "-vf", `select=eq(n\\,${frame})`, "-frames:v", "1", "-q:v", "2", "-update", "1", output]);
  if (!(await fs.stat(output)).size) throw new Error(`Empty thumbnail: ${output}`);
}

// ─── Remotion bundle (cached per process) ────────────────────────────────────

let bundleUrlCache: string | undefined;

async function getBundle(): Promise<string> {
  if (bundleUrlCache) return bundleUrlCache;
  const entryPoint = fileURLToPath(new URL("./remotion/Root.tsx", import.meta.url));
  console.log("Bundling Remotion composition...");
  bundleUrlCache = await bundle({ entryPoint });
  return bundleUrlCache;
}

// ─── Main render function ─────────────────────────────────────────────────────

export function sourceFrameRate(rate: string): number {
  const [numerator, denominator = 1] = rate.split("/").map(Number);
  const fps = numerator / denominator;
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error(`Invalid video frame rate: ${rate}`);
  return fps;
}

export function renderConcurrency(value = config.renderConcurrency): number {
  if (!value) return Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));
  const concurrency = Number(value);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > availableParallelism()) {
    throw new Error(`VEOBIBLE_SHORTS_RENDER_CONCURRENCY must be an integer between 1 and ${availableParallelism()}`);
  }
  return concurrency;
}
const readingSilenceConst = 1;
const transitionDuration = 0.5;

/** Build one forward-and-reverse cycle, then loop it only for the reading. */
export async function renderShortVideo(
  output: string,
  sections: AudioSection[],
  videosDir: string,
  title: IntroTitle,
  outroTitle: OutroTitle,
  verseCues: VerseCue[],
  voices?: VoiceTracks,
  workDir = path.dirname(output),
  volumeMultiplier = 1,
  renderOptions: { concurrency?: number } = {},
): Promise<VideoResult> {
  validateReadingVolume(volumeMultiplier);
  if (!sections.length || sections.some(s => !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end <= s.start)) {
    throw new Error("The passage needs at least one valid audio section");
  }

  const intro = path.join(videosDir, "0-intro.mp4");
  const outro = path.join(videosDir, "0-outro.mp4");
  const backgrounds = await backgroundVideos(videosDir);
  const background = backgrounds[randomInt(backgrounds.length)];

  const [introInfo, outroInfo, backgroundInfo] = await Promise.all([
    mediaInfo(intro), mediaInfo(outro), mediaInfo(background),
  ]);
  requireClipStreams(introInfo, intro, !voices || voices.mode === "mix");
  requireClipStreams(outroInfo, outro, !voices || voices.mode === "mix");
  if (!backgroundInfo.streams.some(s => s.codec_type === "video")) throw new Error(`Missing video stream: ${background}`);

  const introDuration = mediaDuration(introInfo, intro);
  const outroDuration = mediaDuration(outroInfo, outro);
  const voiceDurations = voices
    ? await Promise.all([voices.intro, voices.outro].map(async (file) => {
        const info = await mediaInfo(file);
        if (!info.streams.some(s => s.codec_type === "audio")) throw new Error(`Missing voice audio stream: ${file}`);
        return audioStreamDuration(info, file);
      }))
    : undefined;

  const introLength = (voiceDurations?.[0] ?? audioStreamDuration(introInfo, intro)) + 1;
  const outroLength = (voiceDurations?.[1] ?? audioStreamDuration(outroInfo, outro)) + 2;
  const readingDuration = sections.reduce((sum, s) => sum + s.end - s.start, 0);
  if (!verseCues.length || verseCues.some((cue, i) =>
    !cue.text || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) ||
    cue.start < 0 || cue.end > readingDuration + 1e-6 || cue.end <= cue.start ||
    (i > 0 && cue.start < verseCues[i - 1].end - 1e-6)
  )) {
    throw new Error("The reading needs sequential, valid verse timings");
  }

  const introVideo = introInfo.streams.find(s => s.codec_type === "video")!;
  const width = introVideo.width!;
  const height = introVideo.height!;
  const frameRate = introVideo.r_frame_rate!;
  if (!width || !height || !frameRate || !/^\d+\/\d+$/.test(frameRate)) throw new Error(`Invalid video format: ${intro}`);

  const fps = sourceFrameRate(frameRate);
  const concurrency = renderOptions.concurrency ?? renderConcurrency();
  const readingLength = readingDuration + readingSilenceConst * 2;
  const totalFrames = Math.round(introLength * fps) + Math.round(readingLength * fps) + Math.round(outroLength * fps) - 2 * Math.round(transitionDuration * fps);
  const totalDuration = totalFrames / fps;

  const bgVideoDuration = mediaDuration(backgroundInfo, background);
  const readingPalette = await extractBackgroundPalette(background, bgVideoDuration);

  const staging = await fs.mkdtemp(path.join(workDir, ".video-"));
  let cleanupMedia: (() => Promise<void>) | undefined;
  try {
    // Build boomerang (still uses FFmpeg — only the composition/render moves to Remotion)
    const boomerang = path.join(staging, "boomerang.mp4");
    console.log(`Creating boomerang from ${path.basename(background)}...`);
    await ffmpeg([
      "-i", background,
      "-filter_complex",
      `${pictureFilter(0, width, height, frameRate)},split[forward][backward];[forward]setpts=PTS-STARTPTS[f];[backward]reverse,setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1:a=0[v]`,
      "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      boomerang,
    ]);

    // Build Remotion props
    const compositionProps: ShortCompositionProps = {
      introLength,
      introVideoDuration: introDuration,
      outroVideoDuration: outroDuration,
      readingLength,
      outroLength,
      transitionDuration,
      readingSilence: readingSilenceConst,
      introVideoPath: intro,
      boomerangVideoPath: boomerang,
      outroVideoPath: outro,
      sections,
      voices: voices ? { intro: voices.intro, outro: voices.outro, mode: voices.mode } : undefined,
      volumeMultiplier,
      introTitle: title,
      outroTitle,
      verseCues,
      readingPalette,
    };

    console.log(`Rendering complete video with Remotion (${fps.toFixed(3)} FPS, ${concurrency} workers)...`);
    const bundleUrl = await getBundle();
    const media = await prepareRemotionMedia(bundleUrl, compositionProps);
    cleanupMedia = media.cleanup;
    const composition = await selectComposition({
      serveUrl: bundleUrl,
      id: "VeoBibleShort",
      inputProps: media.props as unknown as Record<string, unknown>,
    });

    // Override composition dimensions to match the source clips
    let lastPct = -1;
    await renderMedia({
      composition: {
        ...composition,
        width,
        height,
        durationInFrames: totalFrames,
        fps,
      },
      serveUrl: bundleUrl,
      concurrency,
      imageFormat: "jpeg",
      codec: "h264",
      outputLocation: output,
      inputProps: media.props as unknown as Record<string, unknown>,
      pixelFormat: "yuv420p",
      crf: 20,
      x264Preset: "veryfast",
      audioBitrate: "192k",
      audioCodec: "aac",
      onProgress: ({ progress }) => {
        if (progress !== undefined) {
          const pct = Math.round(progress * 100);
          if (pct !== lastPct) {
            lastPct = pct;
            process.stdout.write(`\rRendering: ${pct}%   `);
          }
        }
      },
    });
    process.stdout.write("\n");

    return {
      background: path.basename(background),
      duration: totalDuration,
      readingDuration,
      thumbnailTime: introThumbnailTime(introLength, frameRate),
    };
  } finally {
    await cleanupMedia?.();
    await fs.rm(staging, { recursive: true, force: true });
  }
}
