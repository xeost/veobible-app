import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";
import type { PassageTextVerse } from "./shorts.js";
import { config } from "./config.js";
import type { AudioSection } from "./video.js";
import type { VerseCue } from "./verse-timing.js";
import { validateReadingVolume } from "./reading-audio.js";
import { startAtTopPreservingHistory } from "./terminal-prompts.js";
import { playVerseAudioPreview, type VersePlaybackControls, type PassagePlaybackControls } from "./verse-audio-preview.js";
import { startPreviewPlayback } from "./preview-player.js";

const execFileAsync = promisify(execFile);

/** Render the exact adjusted cut, including passages spanning several chapters. */
export async function renderAudioPreview(output: string, sections: AudioSection[], volume = 1, options: { padSections?: boolean } = {}): Promise<void> {
  validateReadingVolume(volume);
  if (!sections.length || sections.some(section => section.start < 0 || section.end <= section.start || !Number.isFinite(section.start + section.end))) throw new Error("Invalid audio preview cut");
  // Container durations can include MP3 encoder padding. Keep chapter joins at
  // their advertised coordinates when building a source buffer for live edits.
  const filters = sections.map((section, index) => `[${index}:a]atrim=start=${section.start.toFixed(6)}:end=${section.end.toFixed(6)},asetpts=PTS-STARTPTS${options.padSections ? `,apad=whole_dur=${(section.end - section.start).toFixed(6)}` : ""},aresample=48000,aformat=channel_layouts=stereo[p${index}]`);
  filters.push(sections.length === 1 ? "[p0]anull[joined]" : `${sections.map((_, index) => `[p${index}]`).join("")}concat=n=${sections.length}:v=0:a=1[joined]`);
  filters.push(`[joined]volume=${volume}${volume > 1 ? ",alimiter=limit=0.95:level=0:latency=1" : ""}[audio]`);
  await execFileAsync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-nostdin", ...sections.flatMap(section => ["-i", section.file]), "-filter_complex", filters.join(";"), "-map", "[audio]", "-c:a", "pcm_s24le", "-y", output], { maxBuffer: 1024 * 1024 });
}

export async function excerptAudioPreview(input: string, output: string, start: number, end: number): Promise<void> {
  await execFileAsync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", input, "-ss", start.toFixed(6), "-t", (end - start).toFixed(6), "-c:a", "pcm_s24le", "-y", output]);
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
export async function playAudioPreview(file: string, options: { label: string; duration: number; offset?: number; cues?: VerseCue[]; referenceVerse?: Pick<VerseCue, "reference" | "text">; passageText?: PassageTextVerse[]; verseControls?: VersePlaybackControls; passageControls?: PassagePlaybackControls }): Promise<"done" | "replay" | "discard"> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Audio timing preview requires an interactive terminal");
  if (options.verseControls || options.passageControls) return playVerseAudioPreview(file, options);
  const playback = await startPreviewPlayback(file);
  let stopped = false, replay = false, refresh = false, cancelled = false, paused = false, pauseBusy = false;
  const completion = playback.finished.then(() => {
    if (cancelled) { const error = new Error("User force closed audio preview"); error.name = "ExitPromptError"; throw error; }
  });
  const stop = () => {
    stopped = true;
    playback.stop();
  };
  const elapsed = () => Math.min(options.duration, playback.position());
  let previousScreen = "";
  let textScroll = 0;
  const textPageSize = () => Math.max(3, (process.stdout.rows || 24) - 11);
  const draw = () => {
    const time = (options.offset ?? 0) + elapsed();
    const cue = options.referenceVerse ?? options.cues?.find(cue => cue.start <= time && time < cue.end);
    const width = Math.max(20, (process.stdout.columns || 80) - 4);
    let content = cue ? `${cue.reference}\n\n${wrap(cue.text, width).join("\n")}` : options.cues ? "Between verses" : "Listen to the beginning and ending of the passage.";
    if (options.passageText) {
      const lines = options.passageText.flatMap(verse => {
        const style = verse.inPassage ? chalk.bold.cyan : chalk.dim;
        return [style(`${verse.inPassage ? "▶" : "·"} ${verse.reference} [${verse.inPassage ? "PASSAGE" : "CONTEXT"}]`), ...wrap(verse.text, width - 2).map(line => style(`  ${line}`)), ""];
      });
      const page = textPageSize();
      textScroll = Math.min(Math.max(0, textScroll), Math.max(0, lines.length - page));
      content = `▶ Passage verses · Context verses\nText lines ${textScroll + 1}–${Math.min(lines.length, textScroll + page)}/${lines.length}\n${lines.slice(textScroll, textScroll + page).join("\n")}`;
    }
    const screen = `${options.label}\n\n${paused ? "Paused" : "Playing"}  ${time.toFixed(2)} s\n\n${content}\n\nEnter / Esc: stop   R: replay   Space: pause/resume\nBackspace: return to the menu at the top   Ctrl+C: exit\n${options.passageText ? "↑/↓: scroll text   PgUp/PgDn: page   Home/End: first/last line\n" : ""}`;
    if (screen !== previousScreen) { process.stdout.write(`\x1b[H\x1b[2J${screen}`); previousScreen = screen; }
  };
  const onKey = (_text: string, key?: { name?: string; ctrl?: boolean }) => {
    if (key?.ctrl && key.name === "c") { cancelled = true; stop(); }
    else if (options.passageText && ["up", "down", "pageup", "pagedown", "home", "end"].includes(key?.name ?? "")) {
      if (key?.name === "home") textScroll = 0;
      else if (key?.name === "end") textScroll = Number.MAX_SAFE_INTEGER;
      else textScroll += (key?.name === "up" || key?.name === "pageup" ? -1 : 1) * (key?.name?.startsWith("page") ? textPageSize() : 1);
      draw();
    }
    else if (["return", "escape", "backspace", "r"].includes(key?.name ?? "")) {
      replay = key?.name === "r"; refresh = key?.name === "backspace"; stop();
    } else if (key?.name === "space" && !pauseBusy) {
      pauseBusy = true;
      (paused ? playback.resume() : playback.pause()).then(() => { paused = !paused; })
        .catch(error => { if (!stopped) { console.error(`Cannot pause audio: ${error.message}`); stop(); } })
        .finally(() => { pauseBusy = false; if (!stopped) draw(); });
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
    stop();
    if (refresh) startAtTopPreservingHistory();
  }
  return replay ? "replay" : "done";
}
