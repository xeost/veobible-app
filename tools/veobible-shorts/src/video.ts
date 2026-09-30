import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";

const execFileAsync = promisify(execFile);
const readingSilence = 1;
const transitionDuration = 0.5;

export interface AudioSection { file: string; start: number; end: number }
export interface VideoResult { background: string; duration: number; readingDuration: number }
export interface VoiceTracks { intro: string; outro: string; mode: "voice" | "mix" }
export interface IntroTitle { title: string; reference: string; version: string }

const requiredVideoFilters = ["drawtext", "drawbox", "vignette", "color", "fade", "overlay", "xfade", "acrossfade", "reverse", "concat", "silencedetect"];

export async function requireVideoFilters(): Promise<void> {
  const { stdout } = await execFileAsync(config.ffmpegBin, ["-hide_banner", "-filters"]);
  const available = new Set(stdout.split(/\r?\n/).map(line => /^\s*[.A-Z|]{2,3}\s+(\S+)\s/.exec(line)?.[1]).filter(Boolean));
  const missing = requiredVideoFilters.filter(filter => !available.has(filter));
  if (missing.length) throw new Error(`FFmpeg is missing required filters: ${missing.join(", ")}. On macOS, install Homebrew ffmpeg-full or set VEOBIBLE_SHORTS_FFMPEG to a compatible binary (see README).`);
}

export function wrapIntroTitle(title: string): string {
  const lines: string[] = [];
  let line = "";
  for (const word of title.trim().split(/\s+/u)) {
    if (line && `${line} ${word}`.length > 25) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

interface AnimationPhase { start: number; duration: number; exit: number; exitDuration: number }

/** Scale the staggered animation so even a short intro has time to show its text. */
export function introAnimation(length: number): Record<"panel" | "title" | "highlight" | "reference" | "version", AnimationPhase> {
  const scale = Math.min(1, length / 3);
  const exit = Math.max(0.65 * scale, length - Math.min(0.9, length * 0.45));
  const exitDuration = Math.min(0.5, Math.max(0.16, length * 0.2));
  const phase = (start: number, duration: number, exitDelay: number): AnimationPhase => ({
    start: start * scale, duration: Math.max(0.08, duration * scale), exit: exit + exitDelay * scale, exitDuration
  });
  return {
    panel: phase(0, 0.5, 0.28),
    title: phase(0.12, 0.55, 0.18),
    highlight: phase(0.27, 0.55, 0.12),
    reference: phase(0.52, 0.4, 0.06),
    version: phase(0.7, 0.35, 0)
  };
}

export function introPanelFilters(width: number, height: number): string[] {
  const scale = width / 1080;
  const border = Math.max(1, Math.round(2 * scale));
  const panelX = Math.round(width * 0.055);
  const panelY = Math.round(height * 0.29);
  const panelWidth = width - panelX * 2;
  const panelHeight = Math.round(height * 0.405);
  const corner = Math.round(78 * scale);
  const box = (x: number, y: number, w: number, h: number, color: string, thickness = "fill") =>
    `drawbox=x=${Math.round(x)}:y=${Math.round(y)}:w=${Math.max(1, Math.round(w))}:h=${Math.max(1, Math.round(h))}:color=${color}:t=${thickness}`;
  const gold = "0xD9BB81";
  const dimGold = "0xD9BB81@0.52";
  return [
    `${box(panelX, panelY, panelWidth, panelHeight, "0x0B121B@0.70")}:replace=1`,
    box(panelX + 17 * scale, panelY + 17 * scale, panelWidth - 34 * scale, panelHeight - 34 * scale, "0x14202A@0.14"),
    box(panelX, panelY, corner, border, gold),
    box(panelX, panelY, border, corner, gold),
    box(panelX + panelWidth - corner, panelY, corner, border, gold),
    box(panelX + panelWidth - border, panelY, border, corner, gold),
    box(panelX, panelY + panelHeight - border, corner, border, gold),
    box(panelX, panelY + panelHeight - corner, border, corner, gold),
    box(panelX + panelWidth - corner, panelY + panelHeight - border, corner, border, gold),
    box(panelX + panelWidth - border, panelY + panelHeight - corner, border, corner, gold),
    box(width * 0.31, height * 0.328, width * 0.12, border, dimGold),
    box(width * 0.57, height * 0.328, width * 0.12, border, dimGold),
    box(width * 0.5 - border / 2, height * 0.321, border, 28 * scale, gold),
    box(width * 0.5 - 14 * scale, height * 0.328, 28 * scale, border, gold),
    `drawtext=font=Avenir:text=VEOBIBLE:expansion=none:fontsize=${Math.max(8, Math.round(25 * scale))}:fontcolor=${gold}:x=(w-text_w)/2:y=${Math.round(height * 0.356)}`,
    box(width * 0.37, height * 0.54, width * 0.26, border, dimGold),
    box(width * 0.46, height * 0.662, width * 0.08, border, dimGold)
  ];
}

export function introTextFilters(width: number, height: number, textFiles: { title: string; highlight: string; reference: string; version: string }, hasHighlight: boolean, animation: ReturnType<typeof introAnimation>): string[] {
  const scale = width / 1080;
  const expression = (value: number) => Number(value.toFixed(4));
  const escaped = (formula: string) => formula.replaceAll(",", "\\,");
  const text = (font: string, file: string, fontSize: number, y: number, color: string, phase: AnimationPhase, extra = "") => {
    const fontOption = font.startsWith("/") ? `fontfile=${font}` : `font=${font}`;
    const alpha = escaped(`max(0,min(1,min((t-${expression(phase.start)})/${expression(phase.duration)},(${expression(phase.exit + phase.exitDuration)}-t)/${expression(phase.exitDuration)})))`);
    const slide = escaped(`${Math.round(y * height)}+${Math.round(22 * scale)}*max(0,min(1,(${expression(phase.start + phase.duration)}-t)/${expression(phase.duration)}))`);
    return `drawtext=${fontOption}:textfile=${file}:expansion=none:fontsize=${Math.max(8, Math.round(fontSize * scale))}:fontcolor=${color}:x=(w-text_w)/2:y='${slide}':alpha='${alpha}'${extra}`;
  };
  const italicGeorgia = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf";
  return [
    text("Georgia", textFiles.title, 75, 0.405, "0xF9F5E8", animation.title, `:shadowcolor=0x000000@0.5:shadowx=${Math.max(1, Math.round(2 * scale))}:shadowy=${Math.max(1, Math.round(3 * scale))}`),
    ...(hasHighlight ? [text(existsSync(italicGeorgia) ? italicGeorgia : "Georgia", textFiles.highlight, 73, 0.461, "0xF1D39A", animation.highlight, `:shadowcolor=0x000000@0.6:shadowx=${Math.max(1, Math.round(2 * scale))}:shadowy=${Math.max(1, Math.round(3 * scale))}`)] : []),
    text("Avenir", textFiles.reference, 62, 0.565, "0xFFFFFF", animation.reference),
    text("Avenir", textFiles.version, 30, 0.622, "0xCDD5DD", animation.version)
  ];
}

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
export async function renderShortVideo(output: string, sections: AudioSection[], videosDir: string, title: IntroTitle, voices?: VoiceTracks): Promise<VideoResult> {
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
  await requireVideoFilters();

  const staging = await fs.mkdtemp(path.join(path.dirname(output), ".video-"));
  try {
    const [titleLine, ...highlightLines] = wrapIntroTitle(title.title).split("\n");
    const textFiles = {
      title: path.join(staging, "title.txt"),
      highlight: path.join(staging, "highlight.txt"),
      reference: path.join(staging, "reference.txt"),
      version: path.join(staging, "version.txt")
    };
    await Promise.all([
      fs.writeFile(textFiles.title, titleLine, "utf8"),
      fs.writeFile(textFiles.highlight, highlightLines.join("\n"), "utf8"),
      fs.writeFile(textFiles.reference, title.reference, "utf8"),
      fs.writeFile(textFiles.version, title.version, "utf8")
    ]);
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
    const animation = introAnimation(introLength);
    const filters = [
      `${pictureFilter(0, width, height, frameRate)},vignette=angle=PI/5${introLength > introDuration ? `,tpad=stop_mode=clone:stop_duration=${(introLength - introDuration).toFixed(6)}` : ""},trim=duration=${introLength.toFixed(6)},setpts=PTS-STARTPTS,settb=AVTB[v0base]`,
      `color=c=black@0.0:s=${width}x${height}:r=${frameRate}:d=${(introLength + 1).toFixed(6)},format=rgba,${introPanelFilters(width, height).join(",")},fade=t=in:st=0:d=${animation.panel.duration.toFixed(4)}:alpha=1,fade=t=out:st=${animation.panel.exit.toFixed(4)}:d=${animation.panel.exitDuration.toFixed(4)}:alpha=1[titlePanel]`,
      `[v0base][titlePanel]overlay=0:0:format=auto:eof_action=repeat,format=yuv420p,${introTextFilters(width, height, textFiles, highlightLines.length > 0, animation).join(",")}[v0]`,
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
