/**
 * Step 3 — Generate Videos.
 *
 * Supports two main generation workflows set during Step 0:
 *
 *   "book" | "all-books":
 *     Processes each target book individually, producing one video + thumbnail + upload txt per book.
 *     In "book" mode with contiguous continuation enabled, processes the start book and continues
 *     automatically with subsequent contiguous books that have all source files present.
 *
 *   "old-testament" | "new-testament" | "full-bible":
 *     Concatenates all books in the scope into a single video.
 *     Each book shows its own background image while its audio plays.
 *     No thumbnail file is generated.
 *     The upload txt contains the version description and a book-level chapter list.
 */
import fs from "fs";
import path from "path";
import { readBibleIndex, buildBookUrl, padBookNumber, saveChapterOffsets } from "../bible.js";
import { printStep, ok, err, info, warn, C, divider, formatDuration, showNumberedMenu } from "../ui.js";
import { logStep, log } from "../logger.js";
import type { SessionState, BookTarget } from "../types.js";
import {
  getExistingChapterAudioFiles,
  findImageFile,
  outputsDir,
  getOutputVideoPath,
  getOutputInfoPath,
  getOutputThumbnailPath,
  getMultiBookVideoPath,
  getMultiBookInfoPath,
  saveLastBook,
  checkReadiness,
  resolveContiguousTargets,
} from "../filesystem.js";
import { runFFmpegAudiobible, runFFmpegMultiBook, getMediaDuration } from "../ffmpeg.js";
import type { MultiBookSegment } from "../ffmpeg.js";
import { generateUploadInfo, generateMultiBookUploadInfo } from "../youtube.js";
import { config } from "../config.js";

export async function runStep3(session: SessionState): Promise<void> {
  printStep(3, "Generate Videos");

  if (session.mode === "old-testament" || session.mode === "new-testament" || session.mode === "full-bible") {
    await runMultiBookGeneration(session);
    return;
  }

  // ── Individual book generation ("book" | "all-books") ─────────────────────

  const index = readBibleIndex(session.version);

  const chaptersPerBook: Record<string, number> = {};
  for (const book of index.books) {
    chaptersPerBook[book.id] = book.chapters;
  }

  let activeTargets: BookTarget[];

  if (session.mode === "book" && session.continueContiguous) {
    activeTargets = resolveContiguousTargets(session.version.id, index.books, session.defaultBook);
    session.targets = activeTargets;
  } else {
    activeTargets = session.targets;
  }

  if (activeTargets.length === 0) {
    warn("No target books configured for current session.");
    return;
  }

  // Filter to only ready targets
  const readinessResults = checkReadiness(activeTargets, session.version.id, chaptersPerBook);
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
    warn("No books are ready for video generation. Run Step 2 to check readiness.");
    return;
  }

  if (session.mode === "book" && session.continueContiguous) {
    info(
      `Contiguous mode: ${C.accent(String(readyTargets.length))} ready book(s) queued for generation ` +
      `(${readyTargets.map((t) => `${String(t.bookNumber).padStart(2, "0")}. ${t.bookName}`).join(", ")})`
    );
  } else {
    info(`Found ${C.accent(String(readyTargets.length))} book(s) ready to process.`);
  }

  const proceed = await showNumberedMenu<boolean>(
    `Start video generation (${readyTargets.length} book(s))?`,
    [{ label: "Yes, start generation", value: true }],
    "Back to Main Menu"
  );

  if (proceed === null) {
    log("WARN", "Video generation skipped by user.");
    return;
  }

  logStep(3, `Starting generation of ${readyTargets.length} video(s)...`);

  const skipRendering = config.video.skipRendering;
  if (skipRendering) {
    warn("⚠ skipRendering is enabled — FFmpeg encoding and thumbnail copy will be skipped.");
    warn("  Only the *-upload.txt metadata file will be (re)generated for each book.");
    divider();
  }

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
    info(`Processing: ${C.primary.bold(`${session.version.id}-${padBookNumber(target.bookNumber)}-${target.bookId}`)}`);
    info(`  Book: ${C.white(target.bookName)} (${bookData.chapters} chapters)`);

    // In skipRendering mode we regenerate the upload info even if the video exists.
    // In normal mode, skip only when BOTH the video and info file already exist.
    if (!skipRendering && fs.existsSync(outputVideo) && fs.existsSync(outputInfo)) {
      info(`⏭ Skipping — already processed.`);
      skippedCount++;
      continue;
    }

    // In skipRendering mode we don't touch the video at all.
    // In normal mode, if the video exists but info is missing it was interrupted — restart.
    if (!skipRendering && fs.existsSync(outputVideo)) {
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

      // Probe per-chapter durations (needed for YouTube chapter list and progress reporting).
      info(`  Probing chapter durations...`);
      const chapterDurations: number[] = [];
      let totalAudioDur = 0;
      for (const f of chapterAudioFiles) {
        const d = await getMediaDuration(f);
        const dur = d ?? 0;
        chapterDurations.push(dur);
        totalAudioDur += dur;
      }

      // Build cumulative chapter offsets (start second of each chapter).
      const chapterOffsets: number[] = [];
      let runningOffset = 0;
      for (const dur of chapterDurations) {
        chapterOffsets.push(Math.floor(runningOffset));
        runningOffset += dur;
      }

      // Persist the chapter offsets into index.json
      saveChapterOffsets(session.version, target.bookId, chapterOffsets);
      info(`  Chapter offsets saved to index.json (${chapterOffsets.length} chapters).`);

      const renderStartTime = Date.now();

      if (skipRendering) {
        info(`  ⏩ Rendering skipped (skipRendering = true).`);
      } else {
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
      }

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
        chapterDurations,
      });
      info(`Upload info: ${C.muted(path.basename(outputInfo))}`);

      // Copy thumbnail image to outputs/ (skipped when skipRendering is active)
      if (!skipRendering) {
        const outputThumbnail = getOutputThumbnailPath(
          target.bookNumber,
          target.bookId,
          session.version.id,
          imageExt
        );
        fs.copyFileSync(imageFile, outputThumbnail);
        info(`Thumbnail: ${C.muted(path.basename(outputThumbnail))}`);
      }

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

  log("INFO", `Step 3 completed: ${doneCount} done, ${skippedCount} skipped, ${errors.length} errors.`);
}

// ─── Multi-book generation (OT / NT / Full Bible) ─────────────────────────────

async function runMultiBookGeneration(session: SessionState): Promise<void> {
  const scope = session.mode; // "old-testament" | "new-testament" | "full-bible"

  const scopeLabel =
    scope === "old-testament" ? "Old Testament" :
    scope === "new-testament" ? "New Testament" :
    "Complete Bible";

  info(`Scope: ${C.primary.bold(scopeLabel)}`);

  const index = readBibleIndex(session.version);

  const chaptersPerBook: Record<string, number> = {};
  for (const book of index.books) {
    chaptersPerBook[book.id] = book.chapters;
  }

  // Check readiness for all included books
  const readinessResults = checkReadiness(session.targets, session.version.id, chaptersPerBook);
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
    warn("No books are ready for video generation. Run Step 2 to check readiness.");
    return;
  }

  info(`Found ${C.accent(String(readyTargets.length))} book(s) ready to include.`);

  const outputVideo = getMultiBookVideoPath(scope, session.version.id);
  const outputInfo  = getMultiBookInfoPath(scope, session.version.id);

  const skipRendering = config.video.skipRendering;
  if (skipRendering) {
    warn("⚠ skipRendering is enabled — FFmpeg encoding will be skipped.");
    warn("  Only the *-upload.txt metadata file will be (re)generated.");
    divider();
  }

  if (!skipRendering && fs.existsSync(outputVideo) && fs.existsSync(outputInfo)) {
    info(`⏭ Output already exists: ${C.muted(path.basename(outputVideo))}`);
    const overwrite = await showNumberedMenu<boolean>(
      `Overwrite existing video ${path.basename(outputVideo)}?`,
      [{ label: "Yes, overwrite", value: true }],
      "Back to Main Menu"
    );
    if (overwrite === null) {
      log("WARN", "Multi-book video generation skipped by user (already exists).");
      return;
    }
    fs.unlinkSync(outputVideo);
  }

  const proceed = await showNumberedMenu<boolean>(
    `Start ${scopeLabel} video generation (${readyTargets.length} books)?`,
    [{ label: "Yes, start generation", value: true }],
    "Back to Main Menu"
  );

  if (proceed === null) {
    log("WARN", "Multi-book video generation skipped by user.");
    return;
  }

  logStep(3, `Starting multi-book generation: ${scope} — ${readyTargets.length} books.`);
  fs.mkdirSync(outputsDir(), { recursive: true });

  // ── Collect segments and probe durations ──────────────────────────────────
  const segments: MultiBookSegment[] = [];
  const bookObjects: ReturnType<typeof index.books.find>[] = [];
  const bookTotalDurations: number[] = [];

  info("Probing audio durations for all books...");

  for (const target of readyTargets) {
    const bookData = index.books.find((b) => b.id === target.bookId);
    if (!bookData) {
      warn(`Book "${target.bookId}" not found in index — skipping.`);
      continue;
    }

    const chapterAudioFiles = getExistingChapterAudioFiles(
      target.bookNumber,
      target.bookId,
      session.version.id,
      bookData.chapters
    );

    const imageFile = findImageFile(target.bookNumber, target.bookId, session.version.id);
    if (!imageFile) {
      warn(`No image found for "${target.bookId}" — skipping.`);
      continue;
    }

    // Probe total duration for this book
    let bookDur = 0;
    const chapterDurations: number[] = [];
    for (const f of chapterAudioFiles) {
      const d = await getMediaDuration(f);
      const dur = d ?? 0;
      chapterDurations.push(dur);
      bookDur += dur;
    }
    bookTotalDurations.push(bookDur);

    // Build cumulative chapter offsets and persist them to index.json
    const chapterOffsets: number[] = [];
    let runningOffset = 0;
    for (const dur of chapterDurations) {
      chapterOffsets.push(Math.floor(runningOffset));
      runningOffset += dur;
    }
    saveChapterOffsets(session.version, target.bookId, chapterOffsets);

    info(`  ${C.white(target.bookName)}: ${C.accent(String(chapterAudioFiles.length))} chapters, ${C.muted(path.basename(imageFile))}`);

    segments.push({ chapterAudioFiles, backgroundImageFile: imageFile });
    bookObjects.push(bookData);
  }

  if (segments.length === 0) {
    warn("No valid segments assembled — nothing to render.");
    return;
  }

  const totalDur = bookTotalDurations.reduce((a, b) => a + b, 0);
  info(`Total audio duration: ${C.accent(formatDuration(totalDur * 1000))}`);

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderStartTime = Date.now();

  if (skipRendering) {
    info(`⏩ Rendering skipped (skipRendering = true).`);
  } else {
    divider();
    info(`🎬 Starting FFmpeg render for ${C.primary.bold(scopeLabel)}...`);

    await runFFmpegMultiBook({
      segments,
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
    ok(`Video rendered: ${C.muted(path.basename(outputVideo))}`);
  }

  const renderDuration = Date.now() - renderStartTime;

  // ── Generate upload info ────────────────────────────────────────────────────
  generateMultiBookUploadInfo({
    infoPath: outputInfo,
    version: session.version,
    versionMeta: index.metadata,
    scope,
    books: bookObjects.filter((b): b is NonNullable<typeof b> => b !== undefined),
    bookTotalDurations,
  });
  info(`Upload info: ${C.muted(path.basename(outputInfo))}`);

  divider();
  ok(
    `${scopeLabel} complete — ${segments.length} books in ${C.accent(formatDuration(renderDuration))}`
  );
  info(`Outputs saved to: ${C.muted(outputsDir())}`);

  log("INFO", `Step 3 (multi-book: ${scope}) completed: ${segments.length} books rendered.`);
}
