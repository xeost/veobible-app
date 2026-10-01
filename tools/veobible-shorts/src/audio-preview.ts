import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { emitKeypressEvents } from "node:readline";
import { performance } from "node:perf_hooks";
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type { AudioSection } from "./video.js";
import type { VerseCue } from "./verse-timing.js";
import { validateReadingVolume } from "./reading-audio.js";
import { startAtTopPreservingHistory } from "./terminal-prompts.js";

const execFileAsync = promisify(execFile);

/** Render the exact adjusted cut, including passages spanning several chapters. */
export async function renderAudioPreview(output: string, sections: AudioSection[], volume = 1): Promise<void> {
  validateReadingVolume(volume);
  if (!sections.length || sections.some(section => section.start < 0 || section.end <= section.start || !Number.isFinite(section.start + section.end))) throw new Error("Invalid audio preview cut");
  const filters = sections.map((section, index) => `[${index}:a]atrim=start=${section.start.toFixed(6)}:end=${section.end.toFixed(6)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p${index}]`);
  filters.push(sections.length === 1 ? "[p0]anull[joined]" : `${sections.map((_, index) => `[p${index}]`).join("")}concat=n=${sections.length}:v=0:a=1[joined]`);
  filters.push(`[joined]volume=${volume}${volume > 1 ? ",alimiter=limit=0.95:level=0:latency=1" : ""}[audio]`);
  await execFileAsync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-nostdin", ...sections.flatMap(section => ["-i", section.file]), "-filter_complex", filters.join(";"), "-map", "[audio]", "-c:a", "pcm_s24le", "-y", output], { maxBuffer: 1024 * 1024 });
}

export async function excerptAudioPreview(input: string, output: string, start: number, end: number): Promise<void> {
  await execFileAsync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", input, "-ss", start.toFixed(6), "-t", (end - start).toFixed(6), "-c:a", "pcm_s24le", "-y", output]);
}

function player(): { command: string; args: string[] } {
  if (process.platform === "darwin") return { command: "/usr/bin/afplay", args: [] };
  const sibling = path.join(path.dirname(config.ffmpegBin), process.platform === "win32" ? "ffplay.exe" : "ffplay");
  return { command: existsSync(sibling) ? sibling : "ffplay", args: ["-nodisp", "-autoexit", "-loglevel", "error"] };
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/u)) {
    if (line && line.length + word.length + 1 > width) { lines.push(line); line = ""; }
    line += `${line ? " " : ""}${word}`;
  }
  if (line) lines.push(line);
  return lines;
}

/** Native audio playback with a temporary terminal transport and timed verse text. */
export async function playAudioPreview(file: string, options: { label: string; duration: number; offset?: number; cues?: VerseCue[] }): Promise<"done" | "replay"> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Audio timing preview requires an interactive terminal");
  const chosen = player();
  const child = spawn(chosen.command, [...chosen.args, file], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "", stopped = false, replay = false, refresh = false, cancelled = false, paused = false;
  let started = performance.now(), pausedAt = 0, pausedMilliseconds = 0;
  child.once("spawn", () => { started = performance.now(); });
  child.stderr?.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-8192); });
  const completion = new Promise<void>((resolve, reject) => {
    child.once("error", error => reject(new Error(`Cannot play audio with ${chosen.command}: ${error.message}. On Linux/Windows, install ffplay with FFmpeg.`)));
    child.once("close", code => {
      if (cancelled) { const error = new Error("User force closed audio preview"); error.name = "ExitPromptError"; reject(error); }
      else if (stopped || code === 0) resolve();
      else reject(new Error(`Audio playback failed: ${stderr.trim() || `exit ${code}`}`));
    });
  });
  const stop = () => {
    stopped = true;
    if (paused) child.kill("SIGCONT");
    child.kill("SIGTERM");
  };
  const elapsed = () => Math.min(options.duration, Math.max(0, ((paused ? pausedAt : performance.now()) - started - pausedMilliseconds) / 1000));
  let previousScreen = "";
  const draw = () => {
    const time = (options.offset ?? 0) + elapsed();
    const cue = options.cues?.find(cue => cue.start <= time && time < cue.end);
    const width = Math.max(20, (process.stdout.columns || 80) - 4);
    const content = cue ? `${cue.reference}\n\n${wrap(cue.text, width).join("\n")}` : options.cues ? "Between verses" : "Listen to the beginning and ending of the passage.";
    const screen = `${options.label}\n\n${paused ? "Paused" : "Playing"}  ${time.toFixed(2)} s\n\n${content}\n\nEnter / Esc: stop   R: replay${process.platform !== "win32" ? "   Space: pause/resume" : ""}\nBackspace: return to the menu at the top   Ctrl+C: exit\n`;
    if (screen !== previousScreen) { process.stdout.write(`\x1b[H\x1b[2J${screen}`); previousScreen = screen; }
  };
  const onKey = (_text: string, key?: { name?: string; ctrl?: boolean }) => {
    if (key?.ctrl && key.name === "c") { cancelled = true; stop(); }
    else if (["return", "escape", "backspace", "r"].includes(key?.name ?? "")) {
      replay = key?.name === "r"; refresh = key?.name === "backspace"; stop();
    } else if (key?.name === "space" && process.platform !== "win32") {
      if (paused) { pausedMilliseconds += performance.now() - pausedAt; paused = false; child.kill("SIGCONT"); }
      else { pausedAt = performance.now(); paused = true; child.kill("SIGSTOP"); }
      draw();
    }
  };
  const wasRaw = process.stdin.isRaw, wasFlowing = process.stdin.readableFlowing;
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("keypress", onKey);
  process.stdout.write("\x1b[?1049h\x1b[?25l");
  draw();
  const timer = setInterval(draw, 100);
  try {
    await completion;
  } finally {
    clearInterval(timer);
    process.stdin.off("keypress", onKey);
    process.stdin.setRawMode(Boolean(wasRaw));
    if (wasFlowing !== true) process.stdin.pause();
    process.stdout.write("\x1b[?25h\x1b[?1049l");
    if (!stopped && child.exitCode === null) stop();
    if (refresh) startAtTopPreservingHistory();
  }
  return replay ? "replay" : "done";
}
