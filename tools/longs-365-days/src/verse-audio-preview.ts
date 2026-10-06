import { emitKeypressEvents } from "node:readline";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { excerptAudioPreview } from "./audio-preview.js";
import { startPreviewPlayback, type PreviewPlayback } from "./preview-player.js";
import { startAtTopPreservingHistory } from "./terminal-prompts.js";
import type { VerseCue } from "./verse-timing.js";
import type { PassageTextVerse } from "./episodes.js";
import chalk from "chalk";

export interface PassagePlaybackState {
  start: number;
  end: number;
  startOffset: number;
  endOffset: number;
}

export interface PassagePlaybackControls extends PassagePlaybackState {
  sourceDuration: number;
  setBoundary(edge: "start" | "end", time: number): PassagePlaybackState;
}

export interface VersePlaybackSelection {
  verse: Pick<VerseCue, "reference" | "text">;
  start: number;
  end: number;
  estimateEnd: number;
}

export interface VersePlaybackControls {
  passageDuration: number;
  end: number;
  estimateEnd: number;
  /** Apply a passage-relative end time, including the shared next boundary. */
  setEnd(time: number): number;
  /** Read current timings after edits, rather than the initial cue snapshot. */
  getCues?(): VerseCue[];
  /** Select the next verse in the editor without leaving this transport. */
  nextVerse?(): VersePlaybackSelection | undefined;
}

export function playbackPercent(time: number, start: number, end: number): number {
  return Math.max(0, Math.min(100, (time - start) / Math.max(0.001, end - start) * 100));
}

export function replayLastFive(time: number, start: number): number {
  return Math.max(start, time - 5);
}

export function verseAtTime(cues: VerseCue[], time: number): VerseCue | undefined {
  return cues.find(cue => cue.start <= time && time < cue.end);
}

/** Keeps the terminal transport open across seeks, edits and natural EOF. */
export async function playVerseAudioPreview(file: string, options: {
  label: string; duration: number; offset?: number;
  referenceVerse?: { reference: string; text: string };
  cues?: VerseCue[];
  verseControls?: VersePlaybackControls;
  passageControls?: PassagePlaybackControls;
  passageText?: PassageTextVerse[];
}): Promise<"done" | "discard"> {
  const controls = options.verseControls;
  const passageControls = options.passageControls;
  let passageState: PassagePlaybackState | undefined = passageControls ? { ...passageControls } : undefined;
  let edge: "start" | "end" = "start";
  let start = options.offset ?? 0;
  let end = start + options.duration;
  let verseEnd = controls?.end ?? end;
  let estimateEnd = controls?.estimateEnd ?? end;
  let editingVerse = options.referenceVerse;
  let position = start;
  let child: PreviewPlayback | undefined;
  let paused = false, finished = false, busy = false, closing = false, refresh = false;
  let discard = false;
  let notice = "";
  let textScroll = 0;
  const pageSize = () => Math.max(3, (process.stdout.rows || 24) - 15);
  const wrap = (text: string, width: number) => {
    const lines: string[] = []; let line = "";
    for (const word of text.split(/\s+/u)) {
      if (line && line.length + word.length + 1 > width) { lines.push(line); line = ""; }
      line += `${line ? " " : ""}${word}`;
    }
    if (line) lines.push(line);
    return lines;
  };
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-verse-player-"));
  let generation = 0;
  let resolveDone!: () => void, rejectDone!: (error: Error) => void;
  const done = new Promise<void>((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  const currentTime = () => Math.min(end, position + (child?.position() ?? 0));
  const stopChild = () => {
    const previous = child;
    child = undefined;
    previous?.stop();
    paused = false;
  };
  const draw = () => {
    if (closing) return;
    const time = currentTime();
    const cues = controls?.getCues?.() ?? options.cues;
    const verse = cues ? verseAtTime(cues, time) : editingVerse;
    const status = busy ? "Preparing" : finished ? "Finished" : paused ? "Paused" : "Playing";
    const offset = verseEnd - estimateEnd;
    const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
    const heading = passageState
      ? `Source position: ${time.toFixed(3)} s · Cut: ${start.toFixed(3)}–${end.toFixed(3)} s\nStart offset: ${signed(passageState.startOffset)} s · End offset: ${signed(passageState.endOffset)} s\nEditing passage ${edge.toUpperCase()} · S: select start   F: select end`
      : `Passage position: ${time.toFixed(3)} s · Verse end: ${verseEnd.toFixed(3)} s\nEnd offset: ${signed(offset)} s\nEditing: ${editingVerse?.reference ?? "selected verse"}`;
    let content = verse ? `${verse.reference}\n\n${verse.text}` : "Between verses";
    if (options.passageText) {
      const width = Math.max(20, (process.stdout.columns || 80) - 6);
      const lines = options.passageText.flatMap(row => {
        const style = row.inPassage ? chalk.bold.cyan : chalk.dim;
        return [style(`${row.inPassage ? "▶" : "·"} ${row.reference} [${row.inPassage ? "PASSAGE" : "CONTEXT"}]`), ...wrap(row.text, width).map(line => style(`  ${line}`)), ""];
      });
      textScroll = Math.min(Math.max(0, textScroll), Math.max(0, lines.length - pageSize()));
      content = `Text lines ${textScroll + 1}–${Math.min(lines.length, textScroll + pageSize())}/${lines.length}\n${lines.slice(textScroll, textScroll + pageSize()).join("\n")}`;
    }
    const help = passageState
      ? `A: add 5 seconds to ${edge} offset   D: subtract 5 seconds\nB: rewind 5 seconds   L: play last 5 seconds\nE: set passage ${edge} here   R: replay fragment from beginning`
      : "A: add 5 seconds to verse end   D: subtract 5 seconds\nB: rewind 5 seconds   L: play fragment's last 5 seconds   N: next verse\nE: set verse end here   R: replay fragment";
    const exitHelp = passageControls || controls
      ? "Enter: keep changes and return   Esc: discard changes and return\nBackspace: keep changes and return to menu at top   Ctrl+C: exit"
      : "Enter / Esc: return   Backspace: menu at top   Ctrl+C: exit";
    const screen = `${options.label}\n\n${status}  ${playbackPercent(time, start, end).toFixed(1)}% · ${(time - start).toFixed(2)} / ${(end - start).toFixed(2)} s\n${heading}\n\n${content}\n\n${help}   Space: pause/resume\n${exitHelp}\n${options.passageText ? "↑/↓: scroll text   PgUp/PgDn: page   Home/End: first/last line\n" : ""}${notice}\n`;
    process.stdout.write(`\x1b[H\x1b[2J${screen}`);
  };
  const launch = async (time: number) => {
    position = Math.max(start, Math.min(time, end));
    stopChild();
    finished = position >= end;
    if (finished || closing) return;
    const clip = path.join(temp, `play-${++generation}.wav`);
    await excerptAudioPreview(file, clip, position, end);
    if (closing) return;
    const active = await startPreviewPlayback(clip);
    if (closing) { active.stop(); return; }
    child = active;
    active.finished.then(() => {
      void fs.rm(clip, { force: true }).catch(() => {});
      if (child !== active || closing) return;
      child = undefined;
      position = end; finished = true; draw();
    }).catch(error => { if (child === active && !closing) rejectDone(error); });
  };
  let pending: Promise<void> = Promise.resolve();
  const onKey = (text: string, key?: { name?: string; ctrl?: boolean }) => {
    if (key?.ctrl && key.name === "c") {
      closing = true;
      const error = new Error("User force closed audio preview"); error.name = "ExitPromptError";
      rejectDone(error); return;
    }
    if (["return", "escape", "backspace"].includes(key?.name ?? "")) {
      discard = Boolean(passageControls || controls) && key?.name === "escape";
      refresh = key?.name === "backspace"; closing = true; resolveDone(); return;
    }
    if (busy || closing) return;
    const time = currentTime();
    if (options.passageText && ["up", "down", "pageup", "pagedown", "home", "end"].includes(key?.name ?? "")) {
      if (key?.name === "home") textScroll = 0;
      else if (key?.name === "end") textScroll = Number.MAX_SAFE_INTEGER;
      else textScroll += (key?.name === "up" || key?.name === "pageup" ? -1 : 1) * (key?.name?.startsWith("page") ? pageSize() : 1);
      draw(); return;
    }
    if (passageControls && (key?.name === "s" || key?.name === "f")) {
      edge = key.name === "s" ? "start" : "end";
      draw(); return;
    }
    if (key?.name === "space" && child) {
      const active = child;
      busy = true;
      pending = (paused ? active.resume() : active.pause()).then(() => { paused = !paused; })
        .catch(error => { notice = `Cannot pause audio: ${error.message}`; })
        .finally(() => { busy = false; draw(); });
      draw(); return;
    }
    const action = key?.name;
    if (!["a", "d", "b", "l", "e", "r", ...(controls ? ["n"] : [])].includes(action ?? "")) return;
    busy = true;
    pending = (async () => {
      try {
        if (action === "n") {
          const next = controls?.nextVerse?.();
          if (!next) { notice = "This is the last verse in the passage."; return; }
          editingVerse = next.verse;
          verseEnd = next.end;
          estimateEnd = next.estimateEnd;
          start = Math.max(0, next.start - 1);
          end = Math.min(controls!.passageDuration, next.end + 1);
          notice = `Editing ${next.verse.reference}. Previous adjustments kept in memory.`;
          await launch(start);
          return;
        }
        if (action === "a" || action === "d" || action === "e") {
          // Validation happens before stopping audio or changing the preview.
          if (passageControls) {
            const boundary = edge === "start" ? start : end;
            passageState = passageControls.setBoundary(edge, action === "a" ? boundary + 5 : action === "d" ? boundary - 5 : time);
            start = passageState.start; end = passageState.end;
            notice = `Passage ${edge} adjusted. Offsets kept in memory.`;
          } else {
            verseEnd = controls!.setEnd(action === "a" ? verseEnd + 5 : action === "d" ? verseEnd - 5 : time);
            end = Math.min(controls!.passageDuration, verseEnd + 1);
            notice = `Verse end set to ${verseEnd.toFixed(3)} s. Timings kept in memory.`;
          }
        }
        await launch(action === "b" ? replayLastFive(time, start)
          : action === "l" ? replayLastFive(end, start)
          : action === "r" || (passageControls && edge === "start" && ["a", "d", "e"].includes(action ?? "")) ? start : time);
      } catch (error) {
        notice = `Cannot adjust playback: ${error instanceof Error ? error.message : String(error)}`;
      } finally { busy = false; draw(); }
    })();
    draw();
  };
  const wasRaw = process.stdin.isRaw, wasFlowing = process.stdin.readableFlowing;
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true); process.stdin.resume();
  process.stdin.on("keypress", onKey);
  process.stdout.write("\x1b[?1049h\x1b[?25l");
  const timer = setInterval(draw, 100);
  try {
    busy = true; draw();
    pending = launch(start).finally(() => { busy = false; draw(); });
    // Observe transport failures during initial preparation as well as playback.
    pending.catch(rejectDone);
    await done;
  } finally {
    closing = true; clearInterval(timer); stopChild();
    await pending.catch(() => {});
    process.stdin.off("keypress", onKey);
    process.stdin.setRawMode(Boolean(wasRaw));
    if (wasFlowing !== true) process.stdin.pause();
    process.stdout.write("\x1b[?25h\x1b[?1049l");
    await fs.rm(temp, { recursive: true, force: true });
    if (refresh) startAtTopPreservingHistory();
  }
  return discard ? "discard" : "done";
}
