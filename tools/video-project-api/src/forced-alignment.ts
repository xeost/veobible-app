import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { z } from "zod";
import { analyze } from "./pipeline.js";
import {
  alignmentSignature,
  type AlignmentResult,
} from "./forced-alignment-result.js";
import type { RenderRequest } from "./protocol.js";

type Input = Pick<
  RenderRequest,
  "kind" | "passage" | "version" | "settings" | "voiceTemplates"
> & { sectionIndex?: number };
const workerProcesses = new Set<number>();
export function stopAlignmentWorkers() {
  for (const pid of workerProcesses) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
  }
}
const workerRoot = fileURLToPath(
  new URL("../../forced-aligner/", import.meta.url),
);
const word = z.object({
  text: z.string(),
  start: z.number().finite().nonnegative(),
  end: z.number().finite().nonnegative(),
});
const responseSchema = z.object({
  model: z.string(),
  chapters: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      segments: z.array(
        z.object({
          id: z.string(),
          words: z.array(word).min(1),
          needsReview: z.boolean().default(false),
        }),
      ),
    }),
  ),
});

export function runAlignmentWorker(
  request: string,
  output: string,
  ffmpeg: string,
  onProgress: (value: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.env.VIDEO_ALIGNER_PYTHON ||
        path.join(workerRoot, ".venv/bin/python"),
      [
        process.env.VIDEO_ALIGNER_SCRIPT || path.join(workerRoot, "cli.py"),
        "--request",
        request,
        "--output",
        output,
        "--ffmpeg",
        ffmpeg,
        "--model",
        process.env.VIDEO_ALIGNER_MODEL ||
          "mlx-community/Qwen3-ForcedAligner-0.6B-8bit",
      ],
      { stdio: ["ignore", "pipe", "pipe"], detached: true },
    );
    if (child.pid) workerProcesses.add(child.pid);
    let diagnostics = "",
      buffer = "",
      timedOut = false;
    const configured = Number(
      process.env.VIDEO_ALIGNER_TIMEOUT_SECONDS ?? 1800,
    );
    const timeoutMs =
      (Number.isFinite(configured) && configured > 0 ? configured : 1800) *
      1000;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {}
      }
      killTimer = setTimeout(() => {
        if (child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {}
        }
      }, 2000);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        try {
          const value = JSON.parse(line).progress;
          if (typeof value === "number" && Number.isFinite(value))
            onProgress(Math.min(99, Math.max(0, value)));
        } catch {}
      }
      if (buffer.length > 65536) buffer = "";
    });
    child.stderr.on("data", (chunk) => {
      diagnostics = (diagnostics + chunk.toString()).slice(-12000);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (child.pid) workerProcesses.delete(child.pid);
      if (code === 0 && !timedOut) resolve();
      else
        reject(
          new Error(
            timedOut
              ? "Alignment timed out"
              : `Alignment failed (${code}): ${diagnostics}`,
          ),
        );
    });
  });
}

export async function alignProjectReading(
  input: Input,
  onProgress: (value: number) => void,
): Promise<AlignmentResult> {
  const baseline = await analyze({
    ...input,
    settings: { ...input.settings, verseOffsets: [] },
  });
  const { data, m, sections, cues } = baseline;
  if (input.sectionIndex !== undefined && input.sectionIndex >= sections.length)
    throw new Error("Invalid reading section");
  const indexes = sections
    .map((_, index) => index)
    .filter(
      (index) =>
        input.sectionIndex === undefined || index === input.sectionIndex,
    );
  const chapters = indexes.map((index) => {
    const timing = data.timingInputs[index];
    const estimates = m.timing.estimateChapterCues(
      {
        ...timing,
        verses: data.chapterVerses[index],
        section: {
          ...timing.section,
          start: 0,
          end: data.sourceDurations[index],
        },
      },
      [],
    );
    return {
      index,
      audio: timing.section.file,
      duration: data.sourceDurations[index],
      segments: estimates.map((cue) => ({
        id: cue.reference,
        text: cue.text,
        start: cue.start,
        end: cue.end,
      })),
    };
  });
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "veobible-alignment-"),
  );
  try {
    const request = path.join(directory, "request.json"),
      output = path.join(directory, "result.json");
    await fs.writeFile(
      request,
      JSON.stringify({ language: input.version.locale, chapters }),
    );
    await runAlignmentWorker(request, output, m.config.ffmpegBin, onProgress);
    const result = responseSchema.parse(
      JSON.parse(await fs.readFile(output, "utf8")),
    );
    if (
      result.chapters.length !== indexes.length ||
      new Set(result.chapters.map((c) => c.index)).size !== indexes.length
    )
      throw new Error("Incomplete alignment response");
    const reviewReferences: string[] = [];
    const offsets: AlignmentResult["offsets"] = [],
      padding: AlignmentResult["padding"] = [];
    let elapsed = 0;
    for (const [index, section] of sections.entries()) {
      const chapter = result.chapters.find((entry) => entry.index === index);
      if (indexes.includes(index) && !chapter)
        throw new Error("Missing aligned chapter");
      if (chapter) {
        const expected = chapters.find((item) => item.index === index)!;
        if (
          chapter.segments.length !== expected.segments.length ||
          new Set(chapter.segments.map((s) => s.id)).size !==
            expected.segments.length
        )
          throw new Error("Incomplete aligned transcript");
        let previousEnd = 0;
        for (const segment of expected.segments) {
          const match = chapter.segments.find((s) => s.id === segment.id);
          if (!match) throw new Error("Missing aligned segment");
          for (const word of match.words) {
            if (
              word.end < word.start ||
              word.start < previousEnd - 0.08 ||
              word.end > data.sourceDurations[index] + 1e-6
            )
              throw new Error("Invalid aligned word times");
            previousEnd = word.end;
          }
        }
        const selected = new Set(
          data.timingInputs[index].verses.map(
            (v) =>
              `${data.timingInputs[index].bookName} ${data.timingInputs[index].chapter}:${v.verse}`,
          ),
        );
        let from = section.start,
          to = section.end;
        for (const segment of chapter.segments.filter((s) =>
          selected.has(s.id),
        )) {
          if (segment.needsReview) reviewReferences.push(segment.id);
          const cue = cues.find((c) => c.reference === segment.id);
          if (!cue) throw new Error("Aligned verse missing from passage");
          // Modest acoustic margins preserve initial/final consonants.
          const start = Math.max(0, segment.words[0].start - 0.03);
          const end = Math.min(
            data.sourceDurations[index],
            segment.words.at(-1)!.end + 0.05,
          );
          if (end - start < 0.08) throw new Error("Empty aligned verse");
          offsets.push({
            reference: cue.reference,
            startOffsetSeconds: start - (section.start + cue.start - elapsed),
            endOffsetSeconds: end - (section.start + cue.end - elapsed),
            manuallyAdjusted: false,
          });
          from = Math.min(from, start);
          to = Math.max(to, end);
        }
        const existing = input.settings.readingSectionPadding.find(
          (item) => item.sectionIndex === index,
        );
        padding.push({
          sectionIndex: index,
          beforeSeconds: (existing?.beforeSeconds ?? 0) + section.start - from,
          afterSeconds: (existing?.afterSeconds ?? 0) + to - section.end,
        });
      }
      elapsed += section.end - section.start;
    }
    return {
      signature: alignmentSignature(input),
      offsets,
      padding,
      model: result.model,
      reviewReferences,
    };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
