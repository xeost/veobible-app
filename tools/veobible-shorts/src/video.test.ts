import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { backgroundVideos, layoutVerse, renderShortVideo, wrapIntroTitle } from "./video.js";
import { config } from "./config.js";
import { canReuseVoiceTracks, introTitle, prepareShort, refineAudioRange, type Passage } from "./shorts.js";
import { outroTitle } from "./social.js";
import { applyVerseOffsets, estimateChapterCues } from "./verse-timing.js";

const testTitle = { title: "Daily word", reference: "John 3:14-19", version: "Test Bible" };
const testOutro = { title: "Follow us", highlight: "to hear more", channel: "VeoBible in English", social: [{ platform: "YouTube", handle: "@veobible" }, { platform: "X", handle: "@example" }], website: "veobible.com" };
const twoVerseCues = [{ reference: "John 3:14", text: "The first verse is shown alone", start: 0, end: 0.4 }, { reference: "John 3:15", text: "The next verse follows", start: 0.4, end: 0.8 }];

test("intro titles use the selected language, reference, and version", () => {
  assert.deepEqual(introTitle("es", "Juan 3:14-19", "Reina Valera 1909"), {
    title: "Esta es tu dosis diaria de la palabra de Dios", reference: "Juan 3:14-19", version: "Reina Valera 1909"
  });
  assert.match(introTitle("en", "John 3:14-19", "King James Version").title, /daily dose/);
  assert.match(introTitle("pt", "João 3:14-19", "Almeida Revista e Corrigida").title, /dose diária/);
  assert.equal(wrapIntroTitle("Esta es tu dosis diaria de la palabra de Dios"), "Esta es tu\ndosis diaria\nde la palabra de Dios");
  for (const locale of ["es", "en", "pt"] as const) {
    const title = introTitle(locale, "", "").title;
    assert.equal(wrapIntroTitle(title).replaceAll("\n", " "), title);
  }
  assert.ok(layoutVerse("Long text ".repeat(70)).fontSize < 64);
});

test("outro uses localized titles and configured accounts", async () => {
  const es = await outroTitle("es");
  const en = await outroTitle("en");
  const pt = await outroTitle("pt");
  assert.equal(`${es.title} ${es.highlight}`, "Síguenos para escuchar más");
  assert.equal(en.channel, "VeoBible in English");
  assert.equal(pt.channel, "VeoBible em Português");
  assert.deepEqual(es.social.map(row => row.platform), ["YouTube", "X", "Instagram", "TikTok"]);
  assert.equal(es.social[0].handle, "@veobible-es");
  assert.equal(en.website, "veobible.com");
});

test("verse timings follow nearby pauses and preserve edited offsets", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-verse-timing-"));
  try {
    const estimates = estimateChapterCues({ chapter: 3, bookName: "John", verses: [{ verse: 14, text: "First phrase" }, { verse: 15, text: "Second phrase" }], section: { file: "chapter.mp3", start: 0, end: 1.3 } }, [{ start: 0.5, end: 0.8 }]);
    assert.ok(Math.abs(estimates[0].end - 0.77) < 0.001);
    assert.equal(estimates[0].end, estimates[1].start);
    const initial = await applyVerseOffsets(root, false, estimates);
    const parsed = JSON.parse(initial.text);
    assert.equal(parsed.verses[0].startOffsetSeconds, 0);
    parsed.verses[0].endOffsetSeconds = -0.1;
    parsed.verses[1].startOffsetSeconds = -0.1;
    await fs.writeFile(path.join(root, "verse-offsets.json"), JSON.stringify(parsed));
    const adjusted = await applyVerseOffsets(root, true, estimates);
    assert.ok(Math.abs(adjusted.cues[0].end - 0.67) < 0.001);
    assert.ok(Math.abs(adjusted.cues[1].start - 0.67) < 0.001);
    parsed.verses[1].startOffsetSeconds = -0.2;
    await fs.writeFile(path.join(root, "verse-offsets.json"), JSON.stringify(parsed));
    await assert.rejects(applyVerseOffsets(root, true, estimates), /overlapping or invalid/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

function audioFrequency(file: string, start: number, length = 0.2): number {
  const samples = execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-i", file, "-ss", String(start), "-t", String(length), "-vn", "-ac", "1", "-ar", "44100", "-f", "f32le", "-"]);
  let crossings = 0;
  for (let offset = 4; offset < samples.length; offset += 4) {
    if (samples.readFloatLE(offset - 4) <= 0 && samples.readFloatLE(offset) > 0) crossings++;
  }
  return crossings / (samples.length / 4 / 44100);
}

function audioPeak(file: string, start: number): number {
  const samples = execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-i", file, "-ss", String(start), "-t", "0.15", "-vn", "-ac", "1", "-ar", "44100", "-f", "f32le", "-"]);
  let peak = 0;
  for (let offset = 0; offset < samples.length; offset += 4) peak = Math.max(peak, Math.abs(samples.readFloatLE(offset)));
  return peak;
}

function frameRgb(file: string, at: number, x = 0, y = 0): [number, number, number] {
  const frame = execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const offset = (y * 160 + x) * 3;
  return [frame[offset], frame[offset + 1], frame[offset + 2]];
}

function brightTextPixels(file: string, at: number): number {
  const frame = execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  let count = 0;
  for (let y = 105; y < 180; y++) {
    for (let x = 20; x < 140; x++) {
      const offset = (y * 160 + x) * 3;
      if (frame[offset] > 180 && frame[offset + 1] > 180 && frame[offset + 2] > 180) count++;
    }
  }
  return count;
}

test("FFmpeg pauses refine approximate passage boundaries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-pauses-test-"));
  try {
    const audio = path.join(root, "pauses.wav");
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=500:duration=0.8", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:d=0.4", "-f", "lavfi", "-i", "sine=frequency=500:duration=0.8", "-filter_complex", "[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]", "-map", "[a]", "-y", audio]);
    const start = await refineAudioRange(audio, { start: 1.05, end: 2 }, 2);
    const end = await refineAudioRange(audio, { start: 0, end: 0.95 }, 2);
    assert.ok(Math.abs(start.start - 1.16) < 0.06);
    assert.ok(Math.abs(end.end - 0.88) < 0.06);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("creates a complete video with a looped boomerang and the passage audio", { timeout: 60000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-video-test-"));
  const videos = path.join(root, "videos");
  const output = path.join(root, "short.mp4");
  try {
    await fs.mkdir(videos);
    for (const [name, color] of [["0-intro.mp4", "red"], ["0-outro.mp4", "blue"], ["bg-0.mp4", "green"]]) {
      execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${color}:size=160x284:rate=12:duration=0.5`, "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", path.join(videos, name)]);
    }
    await fs.writeFile(path.join(videos, "bg-other.mp4"), "ignored");
    assert.deepEqual(await backgroundVideos(videos), [path.join(videos, "bg-0.mp4")]);
    const reading = path.join(root, "reading.wav");
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=880:duration=1", "-y", reading]);
    const result = await renderShortVideo(output, [{ file: reading, start: 0.1, end: 0.5 }, { file: reading, start: 0.5, end: 0.9 }], videos, testTitle, testOutro, twoVerseCues);
    assert.equal(result.background, "bg-0.mp4");
    assert.equal(result.readingDuration, 0.8);
    const probe = JSON.parse(execFileSync(config.ffprobeBin, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", output], { encoding: "utf8" })) as { format: { duration: string }; streams: Array<{ codec_type: string; width?: number; height?: number }> };
    assert.ok(Math.abs(Number(probe.format.duration) - 5.8) < 0.15, `Rendered duration: ${probe.format.duration} s`);
    assert.ok(probe.streams.some(stream => stream.codec_type === "video" && stream.width === 160 && stream.height === 284));
    assert.ok(probe.streams.some(stream => stream.codec_type === "audio"));
    const titlePanel = frameRgb(output, 0.5, 14, 142);
    assert.ok(titlePanel[0] < 150 && titlePanel[1] < 70 && titlePanel[2] < 70, `Title panel pixel: ${titlePanel.join(",")}`);
    assert.equal(brightTextPixels(output, 0.04), 0);
    assert.ok(brightTextPixels(output, 0.7) > 10);
    assert.equal(brightTextPixels(output, 1.4), 0);
    const introToReading = frameRgb(output, 1.25, 80, 20);
    const readingToOutro = frameRgb(output, 3.55, 80, 20);
    assert.ok(introToReading[0] > 40 && introToReading[1] > 20 && introToReading[2] < 30);
    assert.ok(readingToOutro[1] > 20 && readingToOutro[2] > 40 && readingToOutro[0] < 30);
    assert.ok(Math.abs(audioFrequency(output, 0.1) - 440) < 35);
    assert.ok(audioPeak(output, 1.7) < 0.02);
    assert.ok(Math.abs(audioFrequency(output, 2.1) - 880) < 35);
    assert.ok(audioPeak(output, 3) < 0.02);
    assert.ok(audioPeak(output, 3.8) < 0.02);
    assert.ok(Math.abs(audioFrequency(output, 4.45) - 440) < 35);
    assert.deepEqual((await fs.readdir(root)).sort(), ["reading.wav", "short.mp4", "videos"]);
    const introVoice = path.join(root, "intro.wav");
    const outroVoice = path.join(root, "outro.wav");
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=660:duration=0.8", "-y", introVoice]);
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=660:duration=0.8", "-y", outroVoice]);
    for (const mode of ["voice", "mix"] as const) {
      const voicedOutput = path.join(root, `${mode}.mp4`);
      const voiced = await renderShortVideo(voicedOutput, [{ file: reading, start: 0.1, end: 0.5 }], videos, testTitle, testOutro, [{ ...twoVerseCues[0] }], { intro: introVoice, outro: outroVoice, mode });
      assert.ok(Math.abs(voiced.duration - 6) < 0.01);
      const actual = Number(execFileSync(config.ffprobeBin, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", voicedOutput], { encoding: "utf8" }).trim());
      assert.ok(Math.abs(actual - 6) < 0.25, `Rendered duration: ${actual} s`);
      if (mode === "voice") {
        assert.ok(Math.abs(audioFrequency(voicedOutput, 0.1) - 660) < 35);
        assert.ok(audioPeak(voicedOutput, 3.55) < 0.02);
        assert.ok(Math.abs(audioFrequency(voicedOutput, 4.55) - 660) < 35);
      }
    }
    const silentVideos = path.join(root, "silent-videos");
    await fs.mkdir(silentVideos);
    await fs.copyFile(path.join(videos, "bg-0.mp4"), path.join(silentVideos, "bg-0.mp4"));
    for (const name of ["0-intro.mp4", "0-outro.mp4"]) {
      execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-i", path.join(videos, name), "-an", "-c:v", "copy", "-y", path.join(silentVideos, name)]);
    }
    const silentOutput = path.join(root, "silent.mp4");
    await renderShortVideo(silentOutput, [{ file: reading, start: 0.1, end: 0.5 }], silentVideos, testTitle, testOutro, [{ ...twoVerseCues[0] }], { intro: introVoice, outro: outroVoice, mode: "voice" });
    assert.ok(Math.abs(audioFrequency(silentOutput, 0.1) - 660) < 35);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("reprocessing can reuse WAV voices without invoking Chatterbox", { timeout: 60000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-reuse-test-"));
  const videosDir = path.join(root, "videos");
  const audioDir = path.join(root, "audio");
  const bibleDataDir = path.join(root, "bible");
  const outputDir = path.join(root, "outputs");
  const version = config.versions[0];
  const passage: Passage = { id: "john-1-1-2", book: "john", start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 2 } };
  const destination = path.join(outputDir, version.id, passage.id);
  const original = { videosDir: config.videosDir, audioDir: config.audioDir, bibleDataDir: config.bibleDataDir, outputDir: config.outputDir, ttsProvider: config.ttsProvider, ttsPython: config.ttsPython, clipAudioMode: config.clipAudioMode };
  try {
    await fs.mkdir(videosDir);
    await fs.mkdir(path.join(audioDir, version.id), { recursive: true });
    await fs.mkdir(path.join(bibleDataDir, version.locale, version.id, "john"), { recursive: true });
    await fs.mkdir(destination, { recursive: true });
    for (const name of ["0-intro.mp4", "0-outro.mp4", "bg-0.mp4"]) {
      execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=160x284:rate=12:duration=0.5", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", path.join(videosDir, name)]);
    }
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=880:duration=1", "-y", path.join(audioDir, version.id, "01-john-1.mp3")]);
    for (const part of ["intro", "outro"]) {
      execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=660:duration=0.3", "-y", path.join(destination, `${part}.wav`)]);
      await fs.writeFile(path.join(destination, `${part}.txt`), `${part} from previous run\n`);
      await fs.writeFile(path.join(destination, `${part}.aiff`), "old unused format");
    }
    await fs.writeFile(path.join(destination, "old.txt"), "previous output");
    await fs.writeFile(path.join(bibleDataDir, version.locale, version.id, "index.json"), JSON.stringify({ metadata: { name: "Test Bible" }, books: [{ id: "john", name: "John", chapters: 1, versesPerChapter: [2] }] }));
    await fs.writeFile(path.join(bibleDataDir, version.locale, version.id, "john", "1.json"), JSON.stringify([{ verse: 1, text: "First verse" }, { verse: 2, text: "Second verse" }]));
    const oldIntro = await fs.readFile(path.join(destination, "intro.wav"));
    Object.assign(config, { videosDir, audioDir, bibleDataDir, outputDir, ttsProvider: "chatterbox", ttsPython: path.join(root, "missing-python"), clipAudioMode: "voice" });
    assert.equal(await canReuseVoiceTracks(destination), true);
    await prepareShort(version, passage, true, true);
    assert.deepEqual(await fs.readFile(path.join(destination, "intro.wav")), oldIntro);
    assert.equal(await fs.readFile(path.join(destination, "intro.txt"), "utf8"), "intro from previous run\n");
    assert.equal(await fs.readFile(path.join(destination, "outro.txt"), "utf8"), "outro from previous run\n");
    assert.ok((await fs.stat(path.join(destination, "short.mp4"))).size > 0);
    const initialMetadata = await fs.readFile(path.join(destination, "metadata.txt"), "utf8");
    assert.match(initialMetadata, /Locuciones reutilizadas: sí/);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(destination, "offsets.json"), "utf8")), { startSeconds: 0, endSeconds: 0 });
    const verseOffsetFile = path.join(destination, "verse-offsets.json");
    const initialVerses = JSON.parse(await fs.readFile(verseOffsetFile, "utf8"));
    assert.deepEqual(initialVerses.verses.map((item: { reference: string }) => item.reference), ["John 1:1", "John 1:2"]);
    assert.equal(initialVerses.verses[0].endOffsetSeconds, 0);
    const initialReadingDuration = Number(/Duración estimada de la lectura: ([\d.]+)/.exec(initialMetadata)![1]);
    const editedOffsets = '{\n  "startSeconds": 0.1,\n  "endSeconds": -0.1\n}\n';
    await fs.writeFile(path.join(destination, "offsets.json"), editedOffsets);
    initialVerses.verses[0].endOffsetSeconds = -0.05;
    initialVerses.verses[1].startOffsetSeconds = -0.05;
    await fs.writeFile(verseOffsetFile, JSON.stringify(initialVerses, null, 2) + "\n");
    await prepareShort(version, passage, true, true);
    assert.equal(await fs.readFile(path.join(destination, "offsets.json"), "utf8"), editedOffsets);
    const adjustedVerses = JSON.parse(await fs.readFile(verseOffsetFile, "utf8"));
    assert.equal(adjustedVerses.verses[0].endOffsetSeconds, -0.05);
    assert.equal(adjustedVerses.verses[1].startOffsetSeconds, -0.05);
    assert.ok(adjustedVerses.verses[0].estimatedEndSeconds !== initialVerses.verses[0].estimatedEndSeconds);
    const adjustedMetadata = await fs.readFile(path.join(destination, "metadata.txt"), "utf8");
    const adjustedReadingDuration = Number(/Duración estimada de la lectura: ([\d.]+)/.exec(adjustedMetadata)![1]);
    assert.ok(Math.abs(initialReadingDuration - adjustedReadingDuration - 0.2) < 0.02);
    await assert.rejects(fs.access(path.join(destination, "old.txt")));
    await assert.rejects(fs.access(path.join(destination, "intro.aiff")));
    await fs.rm(path.join(destination, "intro.txt"));
    assert.equal(await canReuseVoiceTracks(destination), false);
    await fs.writeFile(path.join(destination, "intro.txt"), "restored script\n");
    await fs.writeFile(path.join(destination, "outro.wav"), "invalid audio");
    assert.equal(await canReuseVoiceTracks(destination), false);
    await fs.writeFile(path.join(destination, "offsets.json"), '{"startSeconds": 99, "endSeconds": 0}\n');
    await assert.rejects(prepareShort(version, passage, true), /produce an invalid audio cut/);
    assert.ok((await fs.stat(path.join(destination, "short.mp4"))).size > 0);
  } finally {
    Object.assign(config, original);
    await fs.rm(root, { recursive: true, force: true });
  }
});
