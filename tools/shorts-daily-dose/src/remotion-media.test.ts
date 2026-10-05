import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepareRemotionMedia } from "./remotion-media.js";
import type { ShortCompositionProps } from "./remotion/types.js";

test("Remotion stages external media with safe, unique names and cleans only its own render", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-remotion-media-"));
  const bundle = path.join(root, "bundle");
  const source = path.join(root, "external files # español");
  let first: Awaited<ReturnType<typeof prepareRemotionMedia>> | undefined;
  let second: typeof first;
  try {
    await fs.mkdir(path.join(source, "other"), { recursive: true });
    const files = ["intro.mp4", "boomerang.mp4", "other/intro.mp4", "reading.mp3", "intro.wav", "outro.wav"].map(file => path.join(source, file));
    for (const [index, file] of files.entries()) await fs.writeFile(file, `media ${index}`);
    const props: ShortCompositionProps = {
      introLength: 2, introVideoDuration: 2, outroVideoDuration: 2, readingLength: 3, outroLength: 2, transitionDuration: 0.5, readingSilence: 1,
      introVideoPath: files[0], boomerangVideoPath: files[1], outroVideoPath: files[2],
      sections: [{ file: files[3], start: 0.1, end: 0.5 }, { file: files[3], start: 0.5, end: 0.9 }],
      voices: { intro: files[4], outro: files[5], mode: "voice" }, volumeMultiplier: 1.5,
      introTitle: { title: "Daily word", reference: "John 3:16", version: "Test" },
      outroTitle: { title: "Follow", highlight: "for more", channel: "VeoBible", social: [], website: "veobible.com" },
      verseCues: [{ reference: "John 3:16", text: "Verse", start: 0, end: 0.8 }], readingPalette: [[240, 230, 220]]
    };
    const original = structuredClone(props);
    first = await prepareRemotionMedia(bundle, props);
    second = await prepareRemotionMedia(bundle, props);
    const assets = [first.props.introVideoPath, first.props.boomerangVideoPath, first.props.outroVideoPath, first.props.sections[0].file, first.props.voices!.intro, first.props.voices!.outro];
    for (const [index, asset] of assets.entries()) {
      assert.match(asset, /^render-media-[\w-]+\/asset-\d+\.(mp4|mp3|wav)$/);
      assert.equal(await fs.readFile(path.join(bundle, "public", asset), "utf8"), `media ${index}`);
    }
    assert.equal(first.props.sections[0].file, first.props.sections[1].file, "Repeated sections share a single staged chapter file");
    assert.notEqual(first.props.introVideoPath, second.props.introVideoPath);
    assert.deepEqual(props, original, "Original paths, audio timings and design props remain unchanged");
    await first.cleanup();
    await fs.access(path.join(bundle, "public", second.props.introVideoPath));
    await assert.rejects(fs.access(path.join(bundle, "public", first.props.introVideoPath)));
    const beforeFailure = await fs.readdir(path.join(bundle, "public"));
    await assert.rejects(prepareRemotionMedia(bundle, { ...props, introVideoPath: path.join(source, "missing.mp4") }), /ENOENT/);
    assert.deepEqual(await fs.readdir(path.join(bundle, "public")), beforeFailure, "Failed copies leave no temporary assets");
    for (const file of files) await fs.access(file);
  } finally {
    await first?.cleanup();
    await second?.cleanup();
    await fs.rm(root, { recursive: true, force: true });
  }
});
