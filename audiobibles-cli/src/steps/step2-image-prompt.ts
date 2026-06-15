/**
 * Step 2 — Copy Image Prompt and open Gemini chat.
 *
 * Only acts on books that have their JSON metadata file in sources/metadata/<versionId>/
 * (i.e., those not deleted after Step 1).
 *
 * For each filtered book:
 *   1. Renders an image creation prompt (book name + version info).
 *   2. Copies it to the clipboard.
 *   3. Opens the configured Gemini chat URL in the browser.
 *   4. Waits for confirmation before moving to the next book.
 *
 * The generated thumbnail should then be saved to:
 *   sources/images/<versionId>/<NN>-<bookId>.<ext>
 */
import clipboard from "clipboardy";
import open from "open";
import { confirm } from "@inquirer/prompts";
import { readBibleIndex, padBookNumber } from "../bible.js";
import { config } from "../config.js";
import { printStep, ok, info, warn, clipboardNotice, divider, C } from "../ui.js";
import { logStep, log } from "../logger.js";
import { findImageFile, filterTargetsByJson, readBookMetadata } from "../filesystem.js";
import type { SessionState } from "../types.js";

/**
 * Builds the image generation prompt for a given Bible book.
 */
function buildImagePrompt(
  bookName: string,
  bookDescription: string,
  versionLabel: string,
  locale: string
): string {
  if (locale === "es") {
    return `Crea una imagen de portada cinematográfica y de alta calidad para un video de La Biblia Hablada.

📖 Libro: ${bookName}
🕊️ Versión: ${versionLabel}

Contexto del libro:
${bookDescription}

Requisitos de la imagen:
- Formato horizontal (16:9), resolución al menos 1920×1080
- Estilo: pintura épica o ilustración bíblica solemne
- Colores ricos y dramáticos (dorados, azules profundos, tonos de desierto)
- El texto del título estará superpuesto después, así que deja espacio visual limpio
- Sin texto dentro de la imagen
- Atmósfera: reverente, atemporal, impactante`;
  }

  return `Create a cinematic, high-quality cover image for an Audiobible video.

📖 Book: ${bookName}
🕊️ Version: ${versionLabel}

Book context:
${bookDescription}

Image requirements:
- Horizontal format (16:9), at least 1920×1080 resolution
- Style: epic painting or solemn biblical illustration
- Rich and dramatic colors (golds, deep blues, desert tones)
- The title text will be overlaid separately, so leave clean visual space
- No text inside the image
- Atmosphere: reverent, timeless, impactful`;
}

export async function runStep2(session: SessionState): Promise<void> {
  printStep(2, "Copy Image Prompts + Open Gemini");
  info("An image prompt will be copied to your clipboard and Gemini will");
  info("open in the browser. Paste the prompt to generate the thumbnail.");
  info(`Save the result to: ${C.primary("sources/images/<versionId>/<NN>-<bookId>.<ext>")}`);
  divider();

  // Only process books that have a JSON metadata file (not deleted after Step 1)
  const filteredTargets = filterTargetsByJson(session.targets, session.version.id);

  if (filteredTargets.length === 0) {
    warn("No books with JSON metadata files found. Run Step 1 first.");
    return;
  }

  const index = readBibleIndex(session.version);

  for (const target of filteredTargets) {
    const bookData = index.books.find((b) => b.id === target.bookId);
    if (!bookData) {
      warn(`Book "${target.bookId}" not found in index — skipping.`);
      continue;
    }

    const imageFile = findImageFile(target.bookNumber, target.bookId, session.version.id);
    if (imageFile) {
      info(`${C.accent("✔")} Image already exists for ${C.primary.bold(target.bookName)} — skipping.`);
      divider();
      continue;
    }

    const prompt = buildImagePrompt(
      target.bookName,
      bookData.description,
      session.version.label,
      session.version.locale
    );

    await clipboard.write(prompt);
    clipboardNotice(
      `${padBookNumber(target.bookNumber)}-${target.bookId}`,
      `${target.bookName} — ${session.version.label}`
    );

    info(
      `Save the image as: ${C.primary.bold(
        `sources/images/${session.version.id}/${padBookNumber(target.bookNumber)}-${target.bookId}.<ext>`
      )}`
    );

    info(`  ${C.muted("Opening:")} ${config.geminiChatUrl}`);
    await open(config.geminiChatUrl);
    ok(`Opened Gemini in browser.`);
    log("INFO", `[${target.bookId}] Image prompt copied. Gemini opened.`);

    await confirm({
      message: C.white("Paste the prompt in Gemini, generate and save the image, then press Enter"),
      default: true,
    });

    divider();
  }

  logStep(2, "Image prompts done.");
  ok("All image prompts copied.");
}
