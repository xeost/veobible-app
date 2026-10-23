import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { analyzeMedia } from "./media-analysis.js";
import { refineAudioRange as shortRange } from "./engines/short/shorts.js";
import { refineAudioRange as longRange } from "./engines/long/episodes.js";
import { detectPauses as shortPauses } from "./engines/short/verse-timing.js";
import { detectPauses as longPauses } from "./engines/long/verse-timing.js";

test("silence detection defaults off and bypasses both FFmpeg paths without touching sources", async () => {
  const previous = process.env.VIDEO_SILENCE_DETECTION;
  try {
    for (const value of [undefined, "0"]) {
      if (value === undefined) delete process.env.VIDEO_SILENCE_DETECTION;
      else process.env.VIDEO_SILENCE_DETECTION = value;
      for (const refine of [shortRange, longRange])
        assert.deepEqual(await refine("/missing-source", { start: 1, end: 2 }, 3), { start: 1, end: 2 });
      for (const pauses of [shortPauses, longPauses]) assert.deepEqual(await pauses("/missing-source"), []);
    }
  } finally {
    if (previous === undefined) delete process.env.VIDEO_SILENCE_DETECTION;
    else process.env.VIDEO_SILENCE_DETECTION = previous;
  }
});

test("probes deduplicate, bound concurrent processes, invalidate modified files and retry failures", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "media-analysis-test-"));
  try {
    const file = path.join(directory, "source");
    const log = path.join(directory, "calls");
    await fs.writeFile(file, "one");
    const script = `const fs=require('node:fs'); fs.appendFileSync(process.argv[1], 'start '+Date.now()+'\\n'); setTimeout(()=>{fs.appendFileSync(process.argv[1], 'end '+Date.now()+'\\n'); console.log(fs.readFileSync(process.argv[2],'utf8'));},100);`;
    const args = ["-e", script, log, file];
    const results = await Promise.all(Array.from({ length: 8 }, () => analyzeMedia(file, process.execPath, args)));
    assert.ok(results.every((r) => r.stdout.trim() === "one"));
    assert.equal((await fs.readFile(log, "utf8")).trim().split("\n").length, 2);
    await analyzeMedia(file, process.execPath, args);
    assert.equal((await fs.readFile(log, "utf8")).trim().split("\n").length, 2);
    await fs.writeFile(file, "changed");
    assert.equal((await analyzeMedia(file, process.execPath, args)).stdout.trim(), "changed");
    await fs.writeFile(log, "");
    await Promise.all(Array.from({ length: 6 }, (_, i) => analyzeMedia(file, process.execPath, [...args, String(i)])));
    let active = 0, maximum = 0;
    for (const line of (await fs.readFile(log, "utf8")).trim().split("\n")) {
      active += line.startsWith("start") ? 1 : -1;
      maximum = Math.max(maximum, active);
    }
    assert.equal(maximum, 2);
    assert.equal(active, 0);
    const failOnce = ["-e", `const fs=require('node:fs'); if(!fs.existsSync(process.argv[1])) {fs.writeFileSync(process.argv[1],'');process.exit(1)} console.log('retried')`, path.join(directory, "retry")];
    await assert.rejects(analyzeMedia(file, process.execPath, failOnce));
    assert.equal((await analyzeMedia(file, process.execPath, failOnce)).stdout.trim(), "retried");
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});


test("enabling silence detection finds real pauses in both engines", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "silence-enabled-test-"));
  const previous = process.env.VIDEO_SILENCE_DETECTION;
  try {
    const source = path.join(directory, "pause.wav");
    await promisify(execFile)("ffmpeg", [
      "-v", "error", "-f", "lavfi", "-i",
      "aevalsrc=if(between(t\\,1\\,2)\\,0\\,0.5*sin(2*PI*440*t)):s=48000:d=3",
      source,
    ]);
    process.env.VIDEO_SILENCE_DETECTION = "1";
    for (const detect of [shortPauses, longPauses]) {
      const pauses = await detect(source);
      assert.ok(pauses.some((p) => Math.abs(p.start - 1) < 0.05 && Math.abs(p.end - 2) < 0.05));
    }
    for (const refine of [shortRange, longRange]) {
      const range = await refine(source, { start: 0, end: 1.5 }, 3);
      assert.ok(Math.abs(range.end - 1.08) < 0.05);
    }
  } finally {
    if (previous === undefined) delete process.env.VIDEO_SILENCE_DETECTION;
    else process.env.VIDEO_SILENCE_DETECTION = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
