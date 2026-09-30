#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { select, confirm } from "@inquirer/prompts";
import boxen from "boxen";
import chalk from "chalk";
import { config } from "./config.js";
import { generateAudioFormatsForExisting, getBook, loadCatalog, markUsed, prepareShort, readIndex, readStatus, reference, refreshMetadataTimings } from "./shorts.js";
import { generateVoice, voiceContext } from "./voice.js";

const languages = [
  { name: "Español", value: "es" },
  { name: "English", value: "en" },
  { name: "Português", value: "pt" }
] as const;

function startAtTopPreservingHistory(): void {
  if (!process.stdout.isTTY) return;
  const rows = process.stdout.rows || 24;
  // Scroll the current viewport into the terminal history, then move to its
  // first row. Clearing the screen here would discard visible prior output.
  process.stdout.write(`\x1b[${rows};1H${"\n".repeat(rows)}\x1b[H`);
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
    const locale = await select({ message: "Selecciona un idioma:", choices: [
      ...languages.map(language => ({ name: language.name, value: language.value })),
      { name: "Salir", value: "exit" }
    ] });
    if (locale === "exit") return;
    const version = await select({ message: "Selecciona una versión de la Biblia:", choices: [
      ...config.versions.filter(v => v.locale === locale).map(v => ({ name: v.label, value: v.id })),
      { name: "Volver", value: "back" }
    ] });
    if (version === "back") continue;
    const selectedVersion = config.versions.find(v => v.id === version)!;
    try {
      const index = await readIndex(selectedVersion);
      const status = await readStatus();
      const passageId = await select({ message: "Selecciona un versículo o rango:", pageSize: 12, choices: [
        ...catalog.map(p => {
          let label: string;
          try { label = reference(getBook(index, p).book.name, p); } catch { label = p.id + " (no disponible)"; }
          return { name: `${status[p.id] ? chalk.yellow("✓ Usado · ") : ""}${label}`, value: p.id };
        }),
        { name: "Volver", value: "back" }
      ] });
      if (passageId === "back") continue;
      const passage = catalog.find(p => p.id === passageId)!;
      const existingOutput = path.join(config.outputDir, selectedVersion.id, passage.id);
      const isPrepared = await fs.access(existingOutput).then(() => true, () => false);
      const action = await select({ message: reference(getBook(index, passage).book.name, passage), choices: [
        ...(!isPrepared ? [{ name: "Preparar audios, voz, texto y metadata", value: "prepare" }] : []),
        ...(isPrepared ? [{ name: "Generar WAV y AIFF de 48 kHz", value: "audio" }] : []),
        ...(isPrepared ? [{ name: "Generar voz de intro y outro con Chatterbox", value: "voice" }] : []),
        ...(isPrepared ? [{ name: "Actualizar tiempos en metadata", value: "timings" }] : []),
        ...(isPrepared && !status[passage.id] ? [{ name: "Marcar como utilizado", value: "mark" }] : []),
        ...(isPrepared ? [{ name: `Ver salida: ${existingOutput}`, value: "show" }] : []),
        { name: "Volver", value: "back" }
      ] });
      if (action === "back") continue;
      if (action === "show") { console.log(existingOutput); continue; }
      if (action === "audio") {
        const output = await generateAudioFormatsForExisting(selectedVersion, passage);
        console.log(chalk.green(`✔ WAV y AIFF de 48 kHz generados en ${output}`));
        continue;
      }
      if (action === "voice") {
        const book = getBook(index, passage).book;
        await generateVoice(existingOutput, voiceContext(selectedVersion, passage, book.name, index.metadata.name, reference(book.name, passage)), true);
        console.log(chalk.green(`✔ Voz de intro y outro generada en ${existingOutput}`));
        continue;
      }
      if (action === "timings") {
        const metadataPath = await refreshMetadataTimings(selectedVersion, passage);
        console.log(chalk.green(`✔ Tiempos actualizados en ${metadataPath}`));
        continue;
      }
      if (action === "mark") {
        if (await confirm({ message: "¿Marcar este rango como utilizado?", default: false })) {
          await markUsed(passage, selectedVersion, existingOutput);
          console.log(chalk.green("✔ Rango marcado como utilizado en status.json"));
        }
        continue;
      }
      const output = await prepareShort(selectedVersion, passage);
      console.log(chalk.green(`✔ Archivos preparados en ${output}`));
      console.log(chalk.yellow("  Los originales contienen capítulos completos; WAV y AIFF contienen el rango con hasta 5 s de margen."));
      if (!status[passage.id] && await confirm({ message: "¿Marcar este rango como utilizado ahora?", default: false })) {
        await markUsed(passage, selectedVersion, output);
        console.log(chalk.green("✔ Rango marcado como utilizado en status.json"));
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
