import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { input } from "@inquirer/prompts";
import { config, type Version } from "./config.js";
import { analyzePassageAudio, applyPassageAudioOffsets, readPassageOffsets, readPassageTextContext, type PassageTextVerse, type Passage, type TimingAdjustments } from "./shorts.js";
import { applyVerseOffsets, estimateVerseCues, type VerseCue } from "./verse-timing.js";
import { offsetsFromCues, moveVerseBoundary } from "./timing-model.js";
import { readReadingAudioSettings } from "./reading-audio.js";
import { renderAudioPreview, excerptAudioPreview, playAudioPreview } from "./audio-preview.js";
import { numberedMenu } from "./terminal-prompts.js";
import type { VersePlaybackControls, PassagePlaybackControls } from "./verse-audio-preview.js";

interface Choice { name: string; value: string; remember?: boolean }
export interface TimingEditorUI {
  choose(message: string, choices: Choice[], menuKey?: string): Promise<string>;
  number(message: string, current: number): Promise<number>;
  play: typeof playAudioPreview;
}

const terminalUI: TimingEditorUI = {
  choose: (message, choices, menuKey) => numberedMenu(menuKey ?? message, { message, choices }),
  number: async (message, current) => Number(await input({
    message, default: String(current),
    validate: value => value.trim() && Number.isFinite(Number(value))
      ? true : "Enter a finite number of seconds, using a decimal point."
  })),
  play: playAudioPreview
};
const choice = (name: string, value: string, remember = true): Choice => ({ name, value, remember });
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
const exitError = (error: unknown) => error instanceof Error && error.name === "ExitPromptError";

/** Edits are transactional in memory; only video generation writes their JSON files. */
export async function editPassageTimings(version: Version, passage: Passage, initial?: TimingAdjustments, ui: TimingEditorUI = terminalUI, volumeMultiplier?: number): Promise<TimingAdjustments | undefined> {
  console.log("Analyzing passage audio for timing adjustments...");
  const analysis = await analyzePassageAudio(version, passage);
  const destination = path.join(config.outputDir, version.id, passage.id);
  const menuKey = `timings/${version.id}/${passage.id}`;
  let audioOffsets = { ...(initial?.passageOffsets ?? (await readPassageOffsets(destination, true)).values) };
  let verseOverrides = initial ? structuredClone(initial.verseOffsets) : undefined;
  const volume = (await readReadingAudioSettings(destination, true, volumeMultiplier)).volumeMultiplier || 1;
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-timing-preview-"));
  const fullPreview = path.join(temp, "passage.wav");
  let previewKey = "";
  let passageText: PassageTextVerse[] | undefined;
  const sourcePreview = path.join(temp, "passage-source.wav");
  let sourcePrepared = false;
  // Keep source audio outside both estimated edges available for live edits.
  // Intermediate cuts stay identical, including passages across chapters.
  const sourceSections = analysis.sections.map((section, index) => ({ ...section,
    start: index === 0 ? 0 : section.start,
    end: index === analysis.sections.length - 1 ? analysis.sourceDurations[index] : section.end
  }));
  const sourceDuration = sourceSections.reduce((sum, section) => sum + section.end - section.start, 0);
  const estimatedStart = analysis.sections[0].start;
  const estimatedEnd = estimatedStart + analysis.sections.reduce((sum, section) => sum + section.end - section.start, 0);
  try {
    const play = async (from: number, to: number, cues?: VerseCue[], referenceVerse?: Pick<VerseCue, "reference" | "text">, passageText?: PassageTextVerse[], verseControls?: VersePlaybackControls) => {
      const sections = applyPassageAudioOffsets(analysis.sections, analysis.sourceDurations, audioOffsets);
      const duration = sections.reduce((sum, section) => sum + section.end - section.start, 0);
      const key = JSON.stringify(sections);
      if (key !== previewKey) {
        console.log("Preparing audio preview...");
        await renderAudioPreview(fullPreview, sections, volume);
        previewKey = key;
      }
      const start = Math.max(0, from), end = Math.min(duration, to);
      let file = fullPreview;
      if (!verseControls && (start > 0 || end < duration)) {
        file = path.join(temp, "excerpt.wav");
        await excerptAudioPreview(fullPreview, file, start, end);
      }
      while (await ui.play(file, { label: analysis.label, duration: end - start, offset: start, cues, referenceVerse, passageText, verseControls }) === "replay") { /* Replay the same exact cut. */ }
    };

    while (true) {
      const sections = applyPassageAudioOffsets(analysis.sections, analysis.sourceDurations, audioOffsets);
      const duration = sections.reduce((sum, section) => sum + section.end - section.start, 0);
      const message = `1. Audio cut — ${analysis.label}\nStart offset ${signed(audioOffsets.startSeconds)} s · End offset ${signed(audioOffsets.endSeconds)} s · Duration ${duration.toFixed(3)} s\nSource cuts: ${sections.map(section => `${path.basename(section.file)} [${section.start.toFixed(3)}–${section.end.toFixed(3)} s]`).join(", ")}`;
      const action = await ui.choose(message, [
        choice("Play complete passage", "play"), choice("Listen to the beginning (first 5 seconds)", "play-start"), choice("Listen to the ending (last 5 seconds)", "play-end"),
        choice("Set start offset…", "set-start"), choice("Set end offset…", "set-end"),
        choice("Reset audio offsets to automatic estimates", "reset"), choice("Continue to verse text timings", "verses"), choice("Back — discard editor changes", "cancel", false)
      ], `${menuKey}/audio`);
      if (action === "cancel") return undefined;
      try {
        if (action.startsWith("play")) {
          if (action === "play") {
            passageText ??= await readPassageTextContext(version, passage, analysis.index);
            if (!sourcePrepared) {
              console.log("Preparing editable passage audio preview...");
              await renderAudioPreview(sourcePreview, sourceSections, volume, { padSections: true });
              sourcePrepared = true;
            }
            const state = () => ({ start: estimatedStart + audioOffsets.startSeconds, end: estimatedEnd + audioOffsets.endSeconds,
              startOffset: audioOffsets.startSeconds, endOffset: audioOffsets.endSeconds });
            const controls: PassagePlaybackControls = { ...state(), sourceDuration, setBoundary: (edge, time) => {
              const next = { ...audioOffsets, [edge === "start" ? "startSeconds" : "endSeconds"]: time - (edge === "start" ? estimatedStart : estimatedEnd) };
              applyPassageAudioOffsets(analysis.sections, analysis.sourceDurations, next);
              audioOffsets = next;
              return state();
            } };
            await ui.play(sourcePreview, { label: analysis.label, duration: controls.end - controls.start, offset: controls.start, passageText, passageControls: controls });
            continue;
          }
          let referenceVerse: Pick<VerseCue, "reference" | "text"> | undefined;
          if (action === "play-start" || action === "play-end") {
            const input = action === "play-start" ? analysis.timingInputs[0] : analysis.timingInputs.at(-1)!;
            const verse = action === "play-start" ? input.verses[0] : input.verses.at(-1)!;
            referenceVerse = { reference: `${input.bookName} ${input.chapter}:${verse.verse}`, text: verse.text };
          }
          await play(action === "play-end" ? Math.max(0, duration - 5) : 0, action === "play-start" ? Math.min(5, duration) : duration, undefined, referenceVerse);
          continue;
        }
        if (action !== "verses") {
          const next = { ...audioOffsets };
          if (action === "reset") { next.startSeconds = 0; next.endSeconds = 0; }
          else {
            const field = action.includes("start") ? "startSeconds" : "endSeconds";
            next[field] = await ui.number(`${field} offset in seconds:`, next[field]);
          }
          applyPassageAudioOffsets(analysis.sections, analysis.sourceDurations, next);
          audioOffsets = next;
          continue;
        }

        console.log("Estimating verse text timings for the adjusted audio cut...");
        const estimates = await estimateVerseCues(analysis.timingInputs.map((entry, index) => ({ ...entry, section: sections[index] })));
        let cues: VerseCue[];
        try {
          cues = (await applyVerseOffsets(destination, true, estimates, verseOverrides)).cues;
        } catch (error) {
          if (exitError(error)) throw error;
          console.error(`Cannot apply existing verse offsets to this cut: ${error instanceof Error ? error.message : String(error)}`);
          const recovery = await ui.choose("Existing verse offsets need correction for the new audio cut:", [choice("Back to audio adjustments", "back", false), choice("Use automatic verse estimates instead", "reset")], `${menuKey}/recovery`);
          if (recovery === "back") continue;
          cues = estimates.map(cue => ({ ...cue }));
        }
        let selected = 0;
        while (true) {
          const cue = cues[selected], estimate = estimates[selected];
          const offsets = offsetsFromCues(estimates, cues);
          const current = offsets[selected];
          const verseAction = await ui.choose(`2. Verse text — ${cue.reference} (${selected + 1}/${cues.length})\n${cue.text}\nShown at ${cue.start.toFixed(3)}–${cue.end.toFixed(3)} s · Start offset ${signed(current.startOffsetSeconds)} s · End offset ${signed(current.endOffsetSeconds)} s\nShared boundaries move both adjacent verses.`, [
            choice("Play complete passage with timed verse text", "play-all"), choice("Play selected verse with context", "play-verse"), choice("Select another verse…", "select"),
            choice("Set start offset…", "set-start"), choice("Set end offset…", "set-end"),
            choice("Reset all verse text offsets to automatic estimates", "reset"), choice("Back to audio adjustments", "audio", false),
            choice("Use these timings — keep in memory", "use"), choice("Back — discard editor changes", "cancel", false)
          ], `${menuKey}/verse`);
          if (verseAction === "cancel") return undefined;
          if (verseAction === "audio") { verseOverrides = offsets; break; }
          if (verseAction === "use") {
            console.log("Timings kept in memory. Create or reprocess the video to save them in its JSON files.");
            return { passageOffsets: audioOffsets, verseOffsets: offsets };
          }
          try {
            if (verseAction.startsWith("play")) {
              const selectedVerse = verseAction === "play-verse";
              await play(selectedVerse ? Math.max(0, cue.start - 1) : 0, selectedVerse ? Math.min(duration, cue.end + 1) : duration, cues,
                selectedVerse ? { reference: cue.reference, text: cue.text } : undefined, undefined,
                selectedVerse ? { passageDuration: duration, end: cue.end, estimateEnd: estimate.end, getCues: () => cues, nextVerse: () => {
                  if (selected + 1 >= cues.length) return undefined;
                  selected++;
                  const next = cues[selected];
                  return { verse: { reference: next.reference, text: next.text }, start: next.start, end: next.end, estimateEnd: estimates[selected].end };
                }, setEnd: time => {
                  cues = moveVerseBoundary(cues, selected, "end", time, duration);
                  return cues[selected].end;
                } } : undefined);
            } else if (verseAction === "select") {
              selected = Number(await ui.choose("Select a verse:", cues.map((item, index) => choice(`${item.reference} · ${item.start.toFixed(2)}–${item.end.toFixed(2)} s`, String(index))), `${menuKey}/verse-selection`));
            } else if (verseAction === "reset") cues = estimates.map(item => ({ ...item }));
            else {
              const edge = verseAction.includes("start") ? "start" : "end";
              const time = estimate[edge] + await ui.number(`${edge} offset in seconds:`, edge === "start" ? current.startOffsetSeconds : current.endOffsetSeconds);
              cues = moveVerseBoundary(cues, selected, edge, time, duration);
            }
          } catch (error) {
            if (exitError(error)) throw error;
            console.error(`Cannot adjust or preview timings: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch (error) {
        if (exitError(error)) throw error;
        console.error(`Cannot adjust or preview audio: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
