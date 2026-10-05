import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readReadingAudioSettings, validateReadingVolume, ensureDefaultVersionSettings, defaultVersionSettingsFilename } from "./reading-audio.js";

test("new passages inherit version defaults while passage and session settings take priority", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-version-settings-"));
  const passage = path.join(root, "rv1909", "john-3-14-19");
  const nextPassage = path.join(root, "rv1909", "john-1-1-2");
  const defaults = path.join(root, "rv1909", defaultVersionSettingsFilename);
  try {
    await fs.mkdir(path.join(passage, "_internal"), { recursive: true });
    assert.equal((await readReadingAudioSettings(nextPassage, false)).volumeMultiplier, 1);
    await assert.rejects(fs.access(defaults), "Opening an editor does not create version defaults");
    await ensureDefaultVersionSettings(passage, 1.5);
    assert.deepEqual(JSON.parse(await fs.readFile(defaults, "utf8")), { volumeMultiplier: 1.5 });
    assert.equal((await readReadingAudioSettings(nextPassage, false)).volumeMultiplier, 1.5);
    assert.equal((await readReadingAudioSettings(nextPassage, true)).volumeMultiplier, 1.5);
    const edited = '{"volumeMultiplier":0.75}\n';
    await fs.writeFile(defaults, edited);
    await ensureDefaultVersionSettings(passage, 2);
    assert.equal(await fs.readFile(defaults, "utf8"), edited, "Rendering never replaces existing defaults");
    const own = '{"volumeMultiplier":2}\n';
    await fs.writeFile(path.join(passage, "_internal", "2-passage-audio-settings.json"), own);
    assert.deepEqual(await readReadingAudioSettings(passage, true), { volumeMultiplier: 2, text: own });
    assert.equal((await readReadingAudioSettings(nextPassage, false)).volumeMultiplier, 0.75);
    assert.equal((await readReadingAudioSettings(nextPassage, false, 0)).volumeMultiplier, 0);
    assert.equal((await readReadingAudioSettings(path.join(root, "kjv", "new"), false)).volumeMultiplier, 1);
    for (const invalid of ["{", "{}", '{"volumeMultiplier":4.1}', '{"volumeMultiplier":"2"}']) {
      await fs.writeFile(defaults, invalid);
      await assert.rejects(readReadingAudioSettings(nextPassage, false), /Invalid JSON|between 0 and 4/);
      assert.equal((await readReadingAudioSettings(passage, true)).volumeMultiplier, 2);
      assert.equal((await readReadingAudioSettings(nextPassage, false, 1.25)).volumeMultiplier, 1.25);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("reading volume accepts bounded decimal multipliers and rejects invalid settings", async () => {
  for (const value of [0, 0.5, 1, 1.25, 2, 4]) validateReadingVolume(value);
  for (const value of [-0.01, 4.01, Infinity, NaN, "2", null, undefined]) {
    assert.throws(() => validateReadingVolume(value), /between 0 and 4/);
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-reading-volume-"));
  const file = path.join(root, "_internal", "2-passage-audio-settings.json");
  try {
    assert.equal((await readReadingAudioSettings(root, true)).volumeMultiplier, 1);
    await fs.mkdir(path.dirname(file));
    const text = '{"volumeMultiplier": 1.5}\n';
    await fs.writeFile(file, text);
    assert.deepEqual(await readReadingAudioSettings(root, true), { volumeMultiplier: 1.5, text });
    assert.equal((await readReadingAudioSettings(root, false)).volumeMultiplier, 1);
    for (const replace of [false, true]) {
      for (const override of [0, 0.75, 4]) {
        const settings = await readReadingAudioSettings(root, replace, override);
        assert.equal(settings.volumeMultiplier, override);
        assert.deepEqual(JSON.parse(settings.text), { volumeMultiplier: override });
        assert.equal(await fs.readFile(file, "utf8"), text, "session changes must not write the JSON before rendering");
      }
      await assert.rejects(readReadingAudioSettings(root, replace, 4.1), /between 0 and 4/);
    }
    for (const invalid of ["{", "[]", "null", "{}", '{"volumeMultiplier":"2"}', '{"volumeMultiplier":5}']) {
      await fs.writeFile(file, invalid);
      await assert.rejects(readReadingAudioSettings(root, true), /Invalid JSON|between 0 and 4/);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
