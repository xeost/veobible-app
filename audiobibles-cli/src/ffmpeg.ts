import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { config } from "./config.js";
import { log } from "./logger.js";

const MAX_CROSSFADE_COPIES = 20;

export interface FFmpegProgress {
  seconds: number;
  totalSeconds: number;
}

export type ProgressCallback = (progress: FFmpegProgress) => void;

/**
 * Returns the duration of a media file in seconds using ffprobe.
 */
export async function getMediaDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? null : duration);
      } else {
        resolve(null);
      }
    });

    ffprobe.on("error", () => resolve(null));
  });
}

function hexToFFmpegColor(hex: string): string {
  return "0x" + hex.replace("#", "").toUpperCase();
}

/**
 * Builds the filtergraph for the background crossfade loop.
 */
function buildBgCrossfadeChain(
  nCopies: number,
  videoDur: number,
  crossfadeDur: number,
  width: string,
  height: string
): string {
  const D = videoDur;
  const F = crossfadeDur;
  const parts: string[] = [];

  const splitOuts = Array.from({ length: nCopies }, (_, i) => `[_bv${i}]`).join("");
  parts.push(`[0:v]split=${nCopies}${splitOuts}`);

  for (let i = 1; i < nCopies; i++) {
    const a = i === 1 ? "[_bv0]" : `[_xf${i - 1}]`;
    const b = `[_bv${i}]`;
    const out = `[_xf${i}]`;
    const offset = i * (D - F);
    parts.push(`${a}${b}xfade=transition=fade:duration=${F.toFixed(6)}:offset=${offset.toFixed(6)}${out}`);
  }

  const last = nCopies > 1 ? `[_xf${nCopies - 1}]` : "[_bv0]";
  parts.push(`${last}scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[bg]`);

  return parts.join(";");
}

/**
 * Builds the full filtergraph with visualizer and glow effect.
 * Input 0 is always the static background image (loop=1 in ffmpeg args).
 * Input 1 is the concatenated audio stream.
 */
function buildVisualizerFiltergraph(options: {
  style: string;
  width: string;
  height: string;
  visHeight: string;
  visColor: string;
  visOpacity: number;
  fps: number;
  audioDur: number | null;
}): string {
  const { style, width, height, visHeight, visColor, visOpacity, fps } = options;

  // For a static image background, simply scale and pad it.
  const bg = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[bg]`;

  const GLOW = "split[_a][_b];[_b]gblur=sigma=18[_g];[_a][_g]blend=all_mode=screen";
  const ox = "(W-w)/2";
  const oy = "H-h-20";

  // Downmix audio to mono for the visualizer.
  // This ensures stereo audio doesn't draw multiple overlapping waves with default colors.
  const pre = `[1:a]aformat=channel_layouts=mono[_mono_a]`;

  let vis = "";
  let compose = "";

  switch (style) {
    case "wave": {
      /**
       * showwaves with mode=cline draws exactly 1 column per audio sample.
       * At 44100 Hz / 30 fps → 1470 samples/frame on a 1920-px canvas → ~76% width.
       *
       * Fix: resample the audio stream to exactly (width × fps) Hz inside the
       * filtergraph so that every frame contains precisely `width` samples,
       * guaranteeing the waveform spans the full canvas width.
       * This resampled stream is only used by the visualizer; the audio mapped
       * to the output file (-map 1:a) is the original unmodified stream.
       */
      const visRate = parseInt(width) * fps; // e.g. 1920 × 30 = 57600 Hz
      vis = (
        `${pre};[_mono_a]aresample=${visRate}[_ar];` +
        `[_ar]showwaves=s=${width}x${visHeight}:mode=cline:rate=${fps}:colors=${visColor}[_vis_raw];` +
        `[_vis_raw]${GLOW}[_vis_opaque]`
      );
      compose = `[bg][vis]overlay=${ox}:${oy}[out]`;
      break;
    }
    case "circle":
      vis = `${pre};[_mono_a]avectorscope=s=${visHeight}x${visHeight}:zoom=1.5:mode=lissajous_xy:draw=dot:scale=log[_vis_raw];[_vis_raw]${GLOW}[_vis_opaque]`;
      compose = `[bg][vis]overlay=(W-w)/2:(H-h)/2[out]`;
      break;
    case "spectrum":
      vis = `${pre};[_mono_a]showcqt=s=${width}x${visHeight}:fps=${fps}:bar_g=3:bar_t=0.5:axis=0:csp=bt709[_vis_raw];[_vis_raw]${GLOW}[_vis_opaque]`;
      compose = `[bg][vis]overlay=${ox}:${oy}[out]`;
      break;
    case "bars":
    default:
      vis = `${pre};[_mono_a]showfreqs=s=${width}x${visHeight}:mode=bar:fscale=log:ascale=log:colors=${visColor}:win_size=4096[_vis_raw];[_vis_raw]${GLOW}[_vis_opaque]`;
      compose = `[bg][vis]overlay=${ox}:${oy}[out]`;
      break;
  }

  const applyOpacity = `[_vis_opaque]colorchannelmixer=aa=${visOpacity}[vis]`;
  return `${bg};${vis};${applyOpacity};${compose}`;
}

/**
 * Writes a temporary FFmpeg concat list file and returns its path.
 * The caller is responsible for deleting it after use.
 */
function writeConcatList(audioFiles: string[]): string {
  const tmpFile = path.join(os.tmpdir(), `audiobibles-concat-${Date.now()}.txt`);
  const content = audioFiles
    .map((f) => `file '${f.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(tmpFile, content, "utf-8");
  return tmpFile;
}

/**
 * Runs FFmpeg to generate a video from multiple chapter audio files
 * and a single static background image.
 *
 * Process:
 *   1. Concatenate all chapter MP3s using the concat demuxer.
 *   2. Loop the static image for the full audio duration.
 *   3. Apply the audio visualizer over the background image.
 */
export async function runFFmpegAudiobible(params: {
  chapterAudioFiles: string[];
  backgroundImageFile: string;
  outputFile: string;
  onProgress?: ProgressCallback;
}): Promise<void> {
  const { chapterAudioFiles, backgroundImageFile, outputFile, onProgress } = params;

  if (chapterAudioFiles.length === 0) {
    throw new Error("No chapter audio files provided.");
  }

  const concatListPath = writeConcatList(chapterAudioFiles);

  try {
    // Get total audio duration by probing the first file and summing if needed.
    // For accuracy, we use the concat approach and let FFmpeg report duration.
    // We estimate the duration by probing each chapter file and summing.
    let audioDur: number | null = 0;
    for (const f of chapterAudioFiles) {
      const d = await getMediaDuration(f);
      if (d === null) { audioDur = null; break; }
      audioDur! += d;
    }

    const [width, height] = config.video.output.resolution.split("x");
    const fps = config.video.output.fps;

    const filtergraph = buildVisualizerFiltergraph({
      style: config.video.visualizer.style,
      width,
      height,
      visHeight: config.video.visualizer.height.toString(),
      visColor: hexToFFmpegColor(config.video.visualizer.color),
      visOpacity: config.video.visualizer.opacity ?? 1.0,
      fps,
      audioDur,
    });

    const args = [
      "-y",
      // Input 0: static background image (loop indefinitely)
      "-loop", "1",
      "-i", backgroundImageFile,
      // Input 1: concatenated audio (via concat demuxer)
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      // Filtergraph
      "-filter_complex", filtergraph,
      "-map", "[out]",
      "-map", "1:a",
      // Video codec
      "-c:v", config.video.output.codec,
      "-crf", config.video.output.crf.toString(),
      "-r", fps.toString(),
      // Audio codec
      "-c:a", "aac",
      "-b:a", "192k",
      // Stop when audio ends
      "-shortest",
      ...(audioDur ? ["-t", audioDur.toFixed(6)] : []),
      // Progress reporting
      "-progress", "pipe:1",
      "-nostats",
      outputFile,
    ];

    log("INFO", `Running FFmpeg for ${outputFile}`);
    log("DEBUG", `FFmpeg args: ${args.join(" ")}`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args);

      let stderr = "";
      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.startsWith("out_time_us=") && audioDur && onProgress) {
            const us = parseInt(line.split("=")[1]);
            const seconds = Math.min(audioDur, us / 1000000);
            onProgress({ seconds, totalSeconds: audioDur });
          }
        }
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          log("ERROR", `FFmpeg failed with code ${code}\n${stderr}`);
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });

      ffmpeg.on("error", (e) => {
        reject(e);
      });
    });
  } finally {
    // Always clean up the temporary concat list file.
    try { fs.unlinkSync(concatListPath); } catch { /* ignore */ }
  }
}
