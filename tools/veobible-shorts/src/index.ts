#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { select, confirm } from "@inquirer/prompts";
import boxen from "boxen";
import chalk from "chalk";
import { config } from "./config.js";
import { canReuseVoiceTracks, getBook, loadCatalog, markUsed, orderPassagesByUsage, prepareShort, readIndex, readStatus, reference } from "./shorts.js";

const languages = [
  { name: "Spanish", value: "es" },
  { name: "English", value: "en" },
  { name: "Portuguese", value: "pt" }
] as const;

function startAtTopPreservingHistory(): void {
  if (!process.stdout.isTTY) return;
  const rows = process.stdout.rows || 24;
  // Scroll the current viewport into the terminal history, then move to its
  // first row. Clearing the screen here would discard visible prior output.
  process.stdout.write(`\x1b[${rows};1H${"\n".repeat(rows)}\x1b[H`);
}

async function promptAtTopOnBackspace<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  while (true) {
    const controller = new AbortController();
    let refresh = false;
    const onKeypress = (_character: string, key: { name?: string } | undefined) => {
      if (key?.name === "backspace") {
        refresh = true;
        controller.abort();
      }
    };
    process.stdin.on("keypress", onKeypress);
    try {
      return await run(controller.signal);
    } catch (error) {
      if (!refresh) throw error;
    } finally {
      process.stdin.off("keypress", onKeypress);
    }
    startAtTopPreservingHistory();
  }
}

function banner(): void {
  console.log(boxen(`${chalk.hex("#C4B5FD").bold("Short Video Production Assistant")}\n${chalk.hex("#6D28D9")("━".repeat(32))}\n${chalk.hex("#34D399")("veobible.com")}${chalk.gray("  ·  Professional Tools")}`, {
    padding: { top: 1, bottom: 1, left: 4, right: 4 }, borderStyle: "double", borderColor: "#7C3AED",
    title: chalk.hex("#A78BFA").bold(" VEOBIBLE SHORTS ") + chalk.hex("#34D399").bold("CLI "), titleAlignment: "center"
  }));
}

async function main(): Promise<void> {
  startAtTopPreservingHistory();
  banner();
  const catalog = await loadCatalog();
  while (true) {
    const locale = await promptAtTopOnBackspace(signal => select({ message: "Select a language:", choices: [
      ...languages.map(language => ({ name: language.name, value: language.value })),
      { name: "Exit", value: "exit" }
    ] }, { signal }));
    if (locale === "exit") return;
    const version = await promptAtTopOnBackspace(signal => select({ message: "Select a Bible version:", choices: [
      ...config.versions.filter(v => v.locale === locale).map(v => ({ name: v.label, value: v.id })),
      { name: "Back", value: "back" }
    ] }, { signal }));
    if (version === "back") continue;
    const selectedVersion = config.versions.find(v => v.id === version)!;
    try {
      const index = await readIndex(selectedVersion);
      const status = await readStatus();
      const passageId = await promptAtTopOnBackspace(signal => select({ message: "Select a passage:", pageSize: 12, choices: [
        ...orderPassagesByUsage(catalog, status).map(p => {
          let label: string;
          try { label = reference(getBook(index, p).book.name, p); } catch { label = p.id + " (unavailable)"; }
          return { name: `${label}${status[p.id] ? chalk.yellow(" · ✓ Used") : ""}`, value: p.id };
        }),
        { name: "Back", value: "back" }
      ] }, { signal }));
      if (passageId === "back") continue;
      const passage = catalog.find(p => p.id === passageId)!;
      const existingOutput = path.join(config.outputDir, selectedVersion.id, passage.id);
      const isPrepared = await fs.access(existingOutput).then(() => true, () => false);
      const action = await promptAtTopOnBackspace(signal => select({ message: reference(getBook(index, passage).book.name, passage), choices: [
        ...(!isPrepared ? [{ name: "Create complete video", value: "prepare" }] : []),
        ...(isPrepared ? [{ name: "Reprocess complete video", value: "reprocess" }] : []),
        ...(isPrepared && !status[passage.id] ? [{ name: "Mark as used", value: "mark" }] : []),
        ...(isPrepared ? [{ name: `Show output: ${existingOutput}`, value: "show" }] : []),
        { name: "Back", value: "back" }
      ] }, { signal }));
      if (action === "back") continue;
      if (action === "show") { console.log(existingOutput); continue; }
      if (action === "reprocess") {
        if (!await promptAtTopOnBackspace(signal => confirm({ message: "Replace all files in this passage's output folder?", default: true }, { signal }))) continue;
        const reuseVoices = config.clipAudioMode !== "video" && await canReuseVoiceTracks(existingOutput)
          ? await promptAtTopOnBackspace(signal => confirm({ message: "Reuse the existing intro and outro audio?", default: true }, { signal }))
          : false;
        const output = await prepareShort(selectedVersion, passage, true, reuseVoices);
        console.log(chalk.green(`✔ Complete video reprocessed: ${path.join(output, "short.mp4")}`));
        continue;
      }
      if (action === "mark") {
        if (await promptAtTopOnBackspace(signal => confirm({ message: "Mark this passage as used?", default: false }, { signal }))) {
          await markUsed(passage, selectedVersion, existingOutput);
          console.log(chalk.green("✔ Passage marked as used in status.json"));
        }
        continue;
      }
      const output = await prepareShort(selectedVersion, passage);
      console.log(chalk.green(`✔ Complete video created: ${path.join(output, "short.mp4")}`));
      if (!status[passage.id] && await promptAtTopOnBackspace(signal => confirm({ message: "Mark this passage as used now?", default: false }, { signal }))) {
        await markUsed(passage, selectedVersion, output);
        console.log(chalk.green("✔ Passage marked as used in status.json"));
      }
    } catch (error) {
      console.error(chalk.red(`✖ ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}

main().catch(error => {
  if (error instanceof Error && (error.name === "ExitPromptError" || error.message.includes("User force closed"))) process.exit(0);
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
