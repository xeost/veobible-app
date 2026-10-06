import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "./config.js";
import { renderEpisodeVideo, generateThumbnail } from "./video.js";
import { prepareEpisode, hasRenderedEpisode } from "./episodes.js";

test("complete episode renders as 1920×1080 with sequential chapter audio and a thumbnail", { timeout: 180000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-landscape-render-"));
  const videos = path.join(root, "videos");
  try {
    await fs.mkdir(videos);
    // Even portrait source clips must result in a landscape video.
    for (const [name, color] of [["0-intro.mp4", "#394c40"], ["0-outro.mp4", "#344459"], ["bg-0.mp4", "#cee4d5"]]) {
      execFileSync(config.ffmpegBin, ["-v", "error", "-f", "lavfi", "-i", `color=c=${color}:size=128x228:rate=12:duration=0.5`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", path.join(videos, name)]);
    }
    const intro = path.join(root, "intro.wav"), outro = path.join(root, "outro.wav");
    const chapters = [path.join(root, "one.wav"), path.join(root, "two.wav")];
    for (const [file, frequency, duration] of [[intro, 200, 1.8], [outro, 300, 0.5], [chapters[0], 440, 1], [chapters[1], 880, 1]] as const) {
      execFileSync(config.ffmpegBin, ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${duration}`, "-y", file]);
    }
    const output = path.join(root, "episode.mp4");
    const result = await renderEpisodeVideo(output, chapters.map(file => ({ file, start: 0, end: 1 })), videos,
      { title: "La Biblia en 365 días", reference: "Éxodo 39:8 – Levítico 1:17", version: "Reina Valera 1909 · Día 33" },
      { title: "Síguenos", highlight: "para escuchar más", channel: "VeoBible en Español", social: ["YouTube", "X", "Instagram", "TikTok"].map(platform => ({ platform, handle: "@VeoBibleEjemplo" })), website: "veobible.com" },
      [{ reference: "Éxodo 39:8", text: "Y el pectoral hizo de obra primorosa, como la obra del ephod, de oro, jacinto, púrpura, carmesí, y lino torcido.", start: 0, end: 1 },
        { reference: "Levítico 1:1", text: "Y llamó Jehová a Moisés, y habló con él desde el tabernáculo del testimonio, diciendo:", start: 1, end: 2 }],
      { intro, outro, mode: "voice" }, root, 1.5, { concurrency: 2 });
    const info = JSON.parse(execFileSync(config.ffprobeBin, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", output], { encoding: "utf8" }));
    const video = info.streams.find((stream: { codec_type: string }) => stream.codec_type === "video");
    assert.equal(video.width, 1920);
    assert.equal(video.height, 1080);
    assert.equal(video.r_frame_rate, "12/1");
    assert.ok(info.streams.some((stream: { codec_type: string }) => stream.codec_type === "audio"));
    assert.ok(Math.abs(Number(info.format.duration) - result.duration) < 0.15);
    // Audio starts one second into the reading stage. Each chapter must be heard alone.
    const readingStart = Math.round(2.8 * 12) / 12 - Math.round(0.5 * 12) / 12 + 1;
    for (const [time, expected, other] of [[readingStart + 0.25, 440, 880], [readingStart + 1.25, 880, 440]]) {
      const pcm = execFileSync(config.ffmpegBin, ["-v", "error", "-i", output, "-ss", String(time), "-t", "0.2", "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], { maxBuffer: 1024 * 1024 });
      const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
      const energy = (frequency: number) => {
        let real = 0, imag = 0;
        samples.forEach((value, i) => { const phase = 2 * Math.PI * frequency * i / 8000; real += value * Math.cos(phase); imag += value * Math.sin(phase); });
        return real ** 2 + imag ** 2;
      };
      assert.ok(energy(expected) > energy(other) * 10, "Chapters play sequentially without overlapping");
    }
    await generateThumbnail(output, path.join(root, "thumbnail.jpg"), result.thumbnailTime);
    assert.ok((await fs.stat(path.join(root, "thumbnail.jpg"))).size > 0);
    for (const [stage, time] of [["intro", 0], ["reading", readingStart + 0.4], ["outro", result.duration - 1.15]] as const) {
      execFileSync(config.ffmpegBin, ["-v", "error", "-i", output, "-ss", String(time), "-frames:v", "1", "-y", path.join(os.tmpdir(), `veobible-longs-${stage}-preview.png`)]);
    }
    const original = { outputDir: config.outputDir, audioDir: config.audioDir, bibleDataDir: config.bibleDataDir, videosDir: config.videosDir, clipAudioMode: config.clipAudioMode };
    const originalFetch = globalThis.fetch;
    try {
      Object.assign(config, { outputDir: path.join(root, "outputs"), audioDir: path.join(root, "audios"), bibleDataDir: path.join(root, "bible"), videosDir: videos, clipAudioMode: "voice" });
      const version = config.versions[0];
      const episode = { id: "episode-001", episode: 1, book: "genesis", start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 1 } };
      const destination = path.join(config.outputDir, version.id, episode.id), internal = path.join(destination, "_internal");
      const data = path.join(config.bibleDataDir, version.locale, version.id);
      await fs.mkdir(path.join(data, "genesis"), { recursive: true });
      await fs.writeFile(path.join(data, "index.json"), JSON.stringify({ metadata: { name: "Test" }, books: [{ id: "genesis", name: "Génesis", chapters: 1, versesPerChapter: [1] }] }));
      await fs.writeFile(path.join(data, "genesis", "1.json"), JSON.stringify([{ verse: 1, text: "En el principio creó Dios los cielos y la tierra." }]));
      await fs.mkdir(path.join(config.audioDir, version.id), { recursive: true });
      execFileSync(config.ffmpegBin, ["-v", "error", "-i", chapters[0], "-y", path.join(config.audioDir, version.id, "01-genesis-1.mp3")]);
      await fs.mkdir(internal, { recursive: true });
      await fs.copyFile(intro, path.join(internal, "1-intro.wav"));
      await fs.copyFile(outro, path.join(internal, "3-outro.wav"));
      await fs.writeFile(path.join(internal, "1-intro.txt"), "Previously approved intro");
      await fs.writeFile(path.join(internal, "3-outro.txt"), "Previously approved outro");
      await fs.writeFile(path.join(internal, "2-passage-audio-settings.json"), '{"volumeMultiplier":1.75}');
      globalThis.fetch = async (url, options) => {
        if (String(url).includes("api.elevenlabs.io")) throw new Error("Approved voices must not be regenerated");
        return originalFetch(url, options);
      };
      assert.equal(await hasRenderedEpisode(destination), false);
      assert.equal(await prepareEpisode(version, episode, false, true), destination);
      assert.equal(await hasRenderedEpisode(destination), true);
      assert.deepEqual(await fs.readFile(path.join(internal, "1-intro.wav")), await fs.readFile(intro));
      assert.deepEqual(await fs.readFile(path.join(internal, "3-outro.wav")), await fs.readFile(outro));
      assert.equal(await fs.readFile(path.join(internal, "1-intro.txt"), "utf8"), "Previously approved intro");
      assert.equal(JSON.parse(await fs.readFile(path.join(internal, "2-passage-audio-settings.json"), "utf8")).volumeMultiplier, 1.75);
    } finally {
      Object.assign(config, original);
      globalThis.fetch = originalFetch;
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
