import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "./config.js";
import { renderEpisodeVideo } from "./video.js";

// Compare complete renders using short samples of the actual backgrounds.
// All files are temporary; publication outputs and narration are untouched.
const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-benchmark-"));
try {
  const videos = path.join(root, "videos");
  await fs.mkdir(videos);
  const background = (await fs.readdir(config.videosDir)).filter(name => /^bg-\d+\.mp4$/i.test(name)).sort()[0];
  if (!background) throw new Error("No background videos available for the benchmark");
  for (const [source, dest] of [["0-intro.mp4", "0-intro.mp4"], ["0-outro.mp4", "0-outro.mp4"], [background, "bg-0.mp4"]]) {
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-i", path.join(config.videosDir, source), "-t", "2", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", path.join(videos, dest)]);
  }
  const audio = path.join(root, "tone.wav");
  execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2.5", audio]);
  const run = async (concurrency: number) => {
    const start = performance.now();
    await renderEpisodeVideo(path.join(root, `short-${concurrency}.mp4`), [{ file: audio, start: 0, end: 2.5 }], videos,
      { title: "Esta es tu dosis diaria de la palabra de Dios", reference: "Juan 3:16", version: "Reina Valera 1909" },
      { title: "Síguenos", highlight: "para escuchar más", channel: "VeoBible en Español", social: [{ platform: "YouTube", handle: "@VeoBible" }], website: "veobible.com" },
      [{ reference: "Juan 3:16", text: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito.", start: 0, end: 2.5 }],
      { intro: audio, outro: audio, mode: "voice" }, root, 1, { concurrency });
    return (performance.now() - start) / 1000;
  };
  console.log("Warming up the bundle and renderer...");
  await run(1);
  const results: { workers: number; seconds: number }[] = [];
  for (const workers of [1, 2, 4].filter(n => n <= os.availableParallelism())) {
    results.push({ workers, seconds: Number((await run(workers)).toFixed(2)) });
  }
  console.table(results);
  results.sort((a, b) => a.seconds - b.seconds);
  console.log(`Fastest sample: VEOBIBLE_LONGS_RENDER_CONCURRENCY=${results[0].workers}`);
  console.log("Results include media preparation and encoding; longer passages may favor a different worker count.");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
