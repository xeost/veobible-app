/**
 * Step 4 — Generate Videos.
 *
 * Only processes books that have their JSON metadata file in sources/<versionId>/
 * (i.e., those not deleted after Step 1).
 *
 * For each filtered, ready book:
 *   1. Collects the sorted list of chapter MP3 files.
 *   2. Finds the book thumbnail image.
 *   3. Runs FFmpeg: concat audio → visualizer over static image → MP4 output.
 *   4. Copies the thumbnail to outputs/ with the correct naming.
 *   5. Generates the YouTube upload info .txt file.
 *   6. Updates last-book.log on fully successful completion.
 */
import fs from "fs";
import path from "path";
import { confirm } from "@inquirer/prompts";
import { readBibleIndex, buildBookUrl, padBookNumber } from "../bible.js";
import { printStep, ok, err, info, warn, C, divider, formatDuration } from "../ui.js";
import { logStep, log } from "../logger.js";
import type { SessionState } from "../types.js";
import {
  getExistingChapterAudioFiles,
  findImageFile,
  outputsDir,
  getOutputVideoPath,
  getOutputInfoPath,
  getOutputThumbnailPath,
  saveLastBook,
  checkReadiness,
  filterTargetsByJson,
} from "../filesystem.js";
import { runFFmpegAudiobible } from "../ffmpeg.js";
import { generateUploadInfo } from "../youtube.js";

export async function runStep4(session: SessionState): Promise<void> {
  printStep(4, "Generate Videos");

  // Only process books that have a JSON metadata file
  const filteredTargets = filterTargetsByJson(session.targets, session.version.id);

  if (filteredTargets.length === 0) {
    warn("No books with JSON metadata files found. Run Step 1 first.");
    return;
  }

  const index = readBibleIndex(session.version);

  const chaptersPerBook: Record<string, number> = {};
  for (const book of index.books) {
    chaptersPerBook[book.id] = book.chapters;
  }

  // Filter to only ready targets
  const readinessResults = checkReadiness(filteredTargets, session.version.id, chaptersPerBook);
  const readyTargets = readinessResults.filter((r) => r.ready);
  const notReadyTargets = readinessResults.filter((r) => !r.ready);

  if (notReadyTargets.length > 0) {
    warn(`${notReadyTargets.length} book(s) not ready and will be skipped:`);
    for (const r of notReadyTargets) {
      info(`  ${C.danger("✖")} ${r.label}`);
    }
    divider();
  }

  if (readyTargets.length === 0) {
    warn("No books are ready for video generation. Run Step 3 to check readiness.");
    return;
  }

  info(`Found ${C.accent(String(readyTargets.length))} book(s) ready to process.`);

  const proceed = await confirm({
    message: C.white("Start video generation?"),
    default: true,
  });

  if (!proceed) {
    log("WARN", "Video generation skipped by user.");
    return;
  }

  logStep(4, `Starting generation of ${readyTargets.length} video(s)...`);
  fs.mkdirSync(outputsDir(), { recursive: true });

  const stepStartTime = Date.now();
  let totalRenderTimeMs = 0;
  let doneCount = 0;
  let skippedCount = 0;
  const errors: { bookId: string; error: unknown }[] = [];

  for (const target of readyTargets) {
    const bookData = index.books.find((b) => b.id === target.bookId);
    if (!bookData) {
      warn(`Book "${target.bookId}" not found in index — skipping.`);
      continue;
    }

    const outputVideo = getOutputVideoPath(target.bookNumber, target.bookId, session.version.id);
    const outputInfo = getOutputInfoPath(target.bookNumber, target.bookId, session.version.id);

    divider();
    info(`Processing: ${C.primary.bold(`${padBookNumber(target.bookNumber)}-${target.bookId}-${session.version.id}`)}`);
    info(`  Book: ${C.white(target.bookName)} (${bookData.chapters} chapters)`);

    // Skip if both video and info file already exist (successful previous run)
    if (fs.existsSync(outputVideo) && fs.existsSync(outputInfo)) {
      info(`⏭ Skipping — already processed.`);
      skippedCount++;
      continue;
    }

    // If video exists but info is missing, it was interrupted — restart
    if (fs.existsSync(outputVideo)) {
      info(`🔄 Was interrupted. Restarting render...`);
      fs.unlinkSync(outputVideo);
    }

    try {
      const chapterAudioFiles = getExistingChapterAudioFiles(
        target.bookNumber,
        target.bookId,
        session.version.id,
        bookData.chapters
      );
      const imageFile = findImageFile(target.bookNumber, target.bookId, session.version.id)!;
      const imageExt = path.extname(imageFile);

      info(`  Chapters: ${C.accent(String(chapterAudioFiles.length))}/${bookData.chapters} audio files`);
      info(`  Image: ${C.muted(path.basename(imageFile))}`);

      const renderStartTime = Date.now();

      await runFFmpegAudiobible({
        chapterAudioFiles,
        backgroundImageFile: imageFile,
        outputFile: outputVideo,
        onProgress: (p) => {
          const ratio = p.seconds / p.totalSeconds;
          const percent = (ratio * 100).toFixed(1);
          const barWidth = 30;
          const filledWidth = Math.floor(ratio * barWidth);
          const bar =
            C.accent("━".repeat(filledWidth)) +
            C.muted("━".repeat(barWidth - filledWidth));

          process.stdout.write(
            `\r  🎬 Rendering: ${C.white("[")}${bar}${C.white("]")} ${C.accent(percent + "%")} [${p.seconds.toFixed(0)}s/${p.totalSeconds.toFixed(0)}s]   `
          );
        },
      });
      process.stdout.write("\n");

      const renderDuration = Date.now() - renderStartTime;
      totalRenderTimeMs += renderDuration;

      // Generate upload info
      const bookUrl = buildBookUrl(session.version, bookData);
      generateUploadInfo({
        infoPath: outputInfo,
        version: session.version,
        versionMeta: index.metadata,
        book: bookData,
        bookNumber: target.bookNumber,
        bookUrl,
      });
      info(`Upload info: ${C.muted(path.basename(outputInfo))}`);

      // Copy thumbnail image to outputs/
      const outputThumbnail = getOutputThumbnailPath(
        target.bookNumber,
        target.bookId,
        session.version.id,
        imageExt
      );
      fs.copyFileSync(imageFile, outputThumbnail);
      info(`Thumbnail: ${C.muted(path.basename(outputThumbnail))}`);

      const elapsedSoFar = Date.now() - stepStartTime;
      ok(
        `Done — ${target.bookName} in ${C.accent(formatDuration(renderDuration))} ` +
        `(Total elapsed: ${C.muted(formatDuration(elapsedSoFar))})`
      );
      doneCount++;
    } catch (e) {
      err(`Failed to process ${target.bookId}: ${e}`);
      log("ERROR", `Failed to process ${target.bookId}: ${e}`);
      errors.push({ bookId: target.bookId, error: e });
    }
  }

  const finalTotalTime = Date.now() - stepStartTime;

  divider();
  if (errors.length > 0) {
    err(`${errors.length} book(s) failed to process.`);
  }
  ok(`Generation complete — ${doneCount} rendered, ${skippedCount} skipped.`);
  info(`Total rendering time: ${C.accent(formatDuration(totalRenderTimeMs))}`);
  info(`Total step duration:  ${C.accent(formatDuration(finalTotalTime))}`);
  info(`Outputs saved to: ${C.muted(outputsDir())}`);

  // Save last processed book number only on a fully successful run (no errors).
  if (errors.length === 0 && doneCount > 0) {
    const lastBookNum = Math.max(...readyTargets.map((t) => t.bookNumber));
    saveLastBook(lastBookNum, session.version.id);
    log("INFO", `Saved last book (${lastBookNum}) for ${session.version.id} to last-book.log`);
  }

  log("INFO", `Step 4 completed: ${doneCount} done, ${skippedCount} skipped, ${errors.length} errors.`);
}
