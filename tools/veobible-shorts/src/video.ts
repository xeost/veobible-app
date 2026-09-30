import fs from "node:fs/promises";
import path from "node:path";
import { randomInt } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const readingSilence = 1;
const transitionDuration = 0.5;

export interface AudioSection { file: string; start: number; end: number }
export interface VideoResult { background: string; duration: number; readingDuration: number }
export interface VoiceTracks { intro: string; outro: string; mode: "voice" | "mix" }

interface MediaInfo {
  streams: Array<{ codec_type: string; width?: number; height?: number; r_frame_rate?: string; duration?: string }>;
  format: { duration?: string };
}

async function mediaInfo(file: string): Promise<MediaInfo> {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,duration:format=duration", "-of", "json", file]);
  return JSON.parse(stdout) as MediaInfo;
}

async function ffmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", ...args], { maxBuffer: 1024 * 1024 });
  } catch (error) {
    throw new Error(`Video rendering failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function duration(info: MediaInfo, file: string): number {
  const value = Number(info.format.duration);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid video duration: ${file}`);
  return value;
}

function audioDuration(info: MediaInfo, file: string): number {
  const value = Number(info.streams.find(stream => stream.codec_type === "audio")?.duration);
  return Number.isFinite(value) && value > 0 ? value : duration(info, file);
}

function requireClipStreams(info: MediaInfo, file: string, needsAudio: boolean): void {
  if (!info.streams.some(stream => stream.codec_type === "video")) throw new Error(`Missing video stream: ${file}`);
  if (needsAudio && !info.streams.some(stream => stream.codec_type === "audio")) throw new Error(`Missing audio stream: ${file}`);
}

/** Select only numbered background clips, independently of directory order. */
export async function backgroundVideos(videosDir: string): Promise<string[]> {
  const entries = await fs.readdir(videosDir, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile() && /^bg-\d+\.mp4$/.test(entry.name)).map(entry => path.join(videosDir, entry.name)).sort();
  if (!files.length) throw new Error(`No bg-[number].mp4 videos found in ${videosDir}`);
  return files;
}

function pictureFilter(input: number, width: number, height: number, frameRate: string): string {
  return `[${input}:v:0]fps=${frameRate},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p`;
}

/** Build one forward-and-reverse cycle, then loop it only for the reading. */
export async function renderShortVideo(output: string, sections: AudioSection[], videosDir: string, voices?: VoiceTracks): Promise<VideoResult> {
  if (!sections.length || sections.some(section => !Number.isFinite(section.start) || !Number.isFinite(section.end) || section.start < 0 || section.end <= section.start)) {
    throw new Error("The passage needs at least one valid audio section");
  }
  const intro = path.join(videosDir, "0-intro.mp4");
  const outro = path.join(videosDir, "0-outro.mp4");
  const backgrounds = await backgroundVideos(videosDir);
  const background = backgrounds[randomInt(backgrounds.length)];
  const [introInfo, outroInfo, backgroundInfo] = await Promise.all([mediaInfo(intro), mediaInfo(outro), mediaInfo(background)]);
  requireClipStreams(introInfo, intro, !voices || voices.mode === "mix");
  requireClipStreams(outroInfo, outro, !voices || voices.mode === "mix");
  if (!backgroundInfo.streams.some(stream => stream.codec_type === "video")) throw new Error(`Missing video stream: ${background}`);
  const introDuration = duration(introInfo, intro);
  const outroDuration = duration(outroInfo, outro);
  const voiceDurations = voices ? await Promise.all([voices.intro, voices.outro].map(async file => {
    const info = await mediaInfo(file);
    if (!info.streams.some(stream => stream.codec_type === "audio")) throw new Error(`Missing voice audio stream: ${file}`);
    return audioDuration(info, file);
  })) : undefined;
  const introLength = (voiceDurations?.[0] ?? audioDuration(introInfo, intro)) + 1;
  const outroLength = (voiceDurations?.[1] ?? audioDuration(outroInfo, outro)) + 1;
  duration(backgroundInfo, background);
  const readingDuration = sections.reduce((sum, section) => sum + section.end - section.start, 0);
  const introVideo = introInfo.streams.find(stream => stream.codec_type === "video")!;
  const width = introVideo.width;
  const height = introVideo.height;
  const frameRate = introVideo.r_frame_rate;
  if (!width || !height || !frameRate || !/^\d+\/\d+$/.test(frameRate)) throw new Error(`Invalid video format: ${intro}`);

  const staging = await fs.mkdtemp(path.join(path.dirname(output), ".video-"));
  try {
    const boomerang = path.join(staging, "boomerang.mp4");
    console.log(`Creating boomerang from ${path.basename(background)}...`);
    await ffmpeg(["-i", background, "-filter_complex", `${pictureFilter(0, width, height, frameRate)},split[forward][backward];[forward]setpts=PTS-STARTPTS[f];[backward]reverse,setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1:a=0[v]`, "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", boomerang]);

    const audioInputs = sections.flatMap(section => ["-i", section.file]);
    const voiceInputs = voices ? ["-i", voices.intro, "-i", voices.outro] : [];
    const audioParts = sections.map((section, index) => `[${index + 3}:a:0]atrim=start=${section.start.toFixed(6)}:end=${section.end.toFixed(6)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[part${index}]`);
    const readingAudio = sections.length === 1
      ? "[part0]anull[reading]"
      : `${sections.map((_, index) => `[part${index}]`).join("")}concat=n=${sections.length}:v=0:a=1[reading]`;
    const clipAudio = (videoInput: number, voiceInput: number, length: number, label: string): string[] => {
      const clip = `[${videoInput}:a:0]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${length.toFixed(6)},asetpts=PTS-STARTPTS`;
      if (!voices) return [`${clip}[${label}]`];
      const speech = `[${voiceInput}:a:0]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${length.toFixed(6)},asetpts=PTS-STARTPTS`;
      if (voices.mode === "voice") return [`${speech}[${label}]`];
      return [
        `${clip},volume=0.25[${label}music]`,
        `${speech}[${label}speech]`,
        `[${label}music][${label}speech]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[${label}]`
      ];
    };
    const clipPicture = (input: number, originalLength: number, length: number, label: string): string => {
      const extension = length > originalLength ? `,tpad=stop_mode=clone:stop_duration=${(length - originalLength).toFixed(6)}` : "";
      return `${pictureFilter(input, width, height, frameRate)}${extension},trim=duration=${length.toFixed(6)},setpts=PTS-STARTPTS,settb=AVTB[${label}]`;
    };
    const firstVoiceInput = 3 + sections.length;
    const readingLength = readingDuration + readingSilence * 2;
    const firstTransitionOffset = introLength - transitionDuration;
    const secondTransitionOffset = introLength + readingLength - transitionDuration * 2;
    const filters = [
      clipPicture(0, introDuration, introLength, "v0"),
      ...clipAudio(0, firstVoiceInput, introLength, "a0"),
      `${pictureFilter(1, width, height, frameRate)},trim=duration=${readingLength.toFixed(6)},setpts=PTS-STARTPTS,settb=AVTB[v1]`,
      ...audioParts,
      readingAudio,
      `[reading]adelay=${readingSilence * 1000}:all=1,apad,atrim=duration=${readingLength.toFixed(6)},asetpts=PTS-STARTPTS[a1]`,
      clipPicture(2, outroDuration, outroLength, "v2"),
      ...clipAudio(2, firstVoiceInput + 1, outroLength, "a2"),
      `[v0][v1]xfade=transition=fade:duration=${transitionDuration}:offset=${firstTransitionOffset.toFixed(6)}[v01]`,
      `[v01][v2]xfade=transition=fade:duration=${transitionDuration}:offset=${secondTransitionOffset.toFixed(6)}[v]`,
      `[a0][a1]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[a01]`,
      `[a01][a2]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[a]`
    ];
    console.log("Rendering complete video...");
    await ffmpeg(["-i", intro, "-stream_loop", "-1", "-i", boomerang, "-i", outro, ...audioInputs, ...voiceInputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", output]);
    return { background: path.basename(background), duration: introLength + readingLength + outroLength - transitionDuration * 2, readingDuration };
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
