#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { confirm, input } from "@inquirer/prompts";
import chalk from "chalk";
import { config } from "./config.js";
import { canReuseVoiceTracks, getBook, loadCatalog, markUsed, orderPassagesByUsage, prepareShort, readIndex, readStatus, reference, regenerateVoiceTrack, isPassageUsed } from "./shorts.js";

import { promptAtTopOnBackspace, numberedMenu } from "./terminal-prompts.js";
import { editPassageTimings } from "./timing-editor.js";
import type { TimingAdjustments } from "./shorts.js";
import { readReadingAudioSettings, validateReadingVolume } from "./reading-audio.js";

const languages = [
  { name: "Spanish", value: "es" },
  { name: "English", value: "en" },
  { name: "Portuguese", value: "pt" }
] as const;

async function main(): Promise<void> {
  const catalog = await loadCatalog();
  const timingSessions = new Map<string, TimingAdjustments>();
  const volumeSessions = new Map<string, number>();
  while (true) {
    const locale = await numberedMenu("languages", { message: "Select a language:", choices: [
      ...languages.map(language => ({ name: language.name, value: language.value })),
      { name: "Exit", value: "exit" }
    ] });
    if (locale === "exit") return;
    const version = await numberedMenu(`versions/${locale}`, { message: "Select a Bible version:", choices: [
      ...config.versions.filter(v => v.locale === locale).map(v => ({ name: v.label, value: v.id })),
      { name: "Back", value: "back", remember: false }
    ] });
    if (version === "back") continue;
    const selectedVersion = config.versions.find(v => v.id === version)!;
    try {
      const index = await readIndex(selectedVersion);
      const status = await readStatus();
      const passageId = await numberedMenu(`passages/${version}`, { message: "Select a passage:", choices: [
        ...orderPassagesByUsage(catalog, status, selectedVersion).map(p => {
          let label: string;
          try { label = reference(getBook(index, p).book.name, p); } catch { label = p.id + " (unavailable)"; }
          return { name: `${label}${isPassageUsed(status, selectedVersion, p) ? chalk.yellow(" · ✓ Used") : ""}`, value: p.id };
        }),
        { name: "Back", value: "back", remember: false }
      ] });
      if (passageId === "back") continue;
      const passage = catalog.find(p => p.id === passageId)!;
      const sessionKey = `${selectedVersion.id}/${passage.id}`;
      while (true) {
        const existingOutput = path.join(config.outputDir, selectedVersion.id, passage.id);
        const status = await readStatus();
        const isPrepared = await fs.access(existingOutput).then(() => true, () => false);
        const action = await numberedMenu(`actions/${sessionKey}`, { message: reference(getBook(index, passage).book.name, passage), choices: [
          { name: "Adjust audio and verse timings", value: "timings" },
          { name: "Adjust reading volume", value: "volume" },
          ...(!isPrepared ? [{ name: "Create complete video", value: "prepare" }] : []),
          ...(isPrepared ? [
            { name: "Regenerate intro audio", value: "intro-audio" },
            { name: "Regenerate outro audio", value: "outro-audio" }
          ] : []),
          ...(isPrepared ? [{ name: "Reprocess complete video", value: "reprocess" }] : []),
          ...(isPrepared && !isPassageUsed(status, selectedVersion, passage) ? [{ name: "Mark as used", value: "mark" }] : []),
          ...(isPrepared ? [{ name: `Show output: ${existingOutput}`, value: "show" }] : []),
          { name: "Back", value: "back", remember: false }
        ] });
        if (action === "back") break;
        if (action === "timings") {
          const adjusted = await editPassageTimings(selectedVersion, passage, timingSessions.get(sessionKey), undefined, volumeSessions.get(sessionKey));
          if (adjusted) timingSessions.set(sessionKey, adjusted);
          continue;
        }
        if (action === "volume") {
          const current = (await readReadingAudioSettings(existingOutput, true, volumeSessions.get(sessionKey))).volumeMultiplier;
          console.log("Reading volume: 0–4, including decimals (use a decimal point). 0 = mute, 1 = original, 0.5 = half amplitude, 2 = double amplitude. Peaks are limited above 1.");
          const value = await promptAtTopOnBackspace(signal => input({
            message: "volumeMultiplier:", default: String(current),
            validate: text => {
              if (!text.trim()) return "Enter a number between 0 and 4.";
              try { validateReadingVolume(Number(text)); return true; }
              catch { return "Enter a number between 0 and 4, using a decimal point."; }
            }
          }, { signal }));
          volumeSessions.set(sessionKey, Number(value));
          console.log(chalk.green("✔ Reading volume kept in memory. Create or reprocess the video to save it."));
          continue;
        }
        if (action === "show") { console.log(existingOutput); continue; }
        if (action === "intro-audio" || action === "outro-audio") {
          const part = action === "intro-audio" ? "intro" : "outro";
          const file = await regenerateVoiceTrack(selectedVersion, passage, part);
          console.log(chalk.green(`✔ ${part === "intro" ? "Intro" : "Outro"} audio regenerated: ${file}`));
          console.log("Reprocess the complete video and reuse existing audio to include this track.");
          continue;
        }
        if (action === "reprocess") {
          if (!await promptAtTopOnBackspace(signal => confirm({ message: "Replace all files in this passage's output folder?", default: true }, { signal }))) continue;
          const reuseVoices = config.clipAudioMode !== "video" && await canReuseVoiceTracks(existingOutput)
            ? await promptAtTopOnBackspace(signal => confirm({ message: "Reuse the existing intro and outro audio?", default: true }, { signal }))
            : false;
          const output = await prepareShort(selectedVersion, passage, true, reuseVoices, timingSessions.get(sessionKey), volumeSessions.get(sessionKey));
          console.log(chalk.green(`✔ Complete video reprocessed: ${path.join(output, "short.mp4")}`));
          continue;
        }
        if (action === "mark") {
          if (await promptAtTopOnBackspace(signal => confirm({ message: "Mark this passage as used?", default: true }, { signal }))) {
            await markUsed(passage, selectedVersion, existingOutput);
            numberedMenu.forget(`passages/${selectedVersion.id}`);
            console.log(chalk.green("✔ Passage marked as used in status.json"));
          }
          continue;
        }
        const output = await prepareShort(selectedVersion, passage, false, false, timingSessions.get(sessionKey), volumeSessions.get(sessionKey));
        console.log(chalk.green(`✔ Complete video created: ${path.join(output, "short.mp4")}`));
        if (!isPassageUsed(status, selectedVersion, passage) && await promptAtTopOnBackspace(signal => confirm({ message: "Mark this passage as used now?", default: true }, { signal }))) {
          await markUsed(passage, selectedVersion, output);
          numberedMenu.forget(`passages/${selectedVersion.id}`);
          console.log(chalk.green("✔ Passage marked as used in status.json"));
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") throw error;
      console.error(chalk.red(`✖ ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}

main().catch(error => {
  if (error instanceof Error && (error.name === "ExitPromptError" || error.message.includes("User force closed"))) process.exit(0);
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
