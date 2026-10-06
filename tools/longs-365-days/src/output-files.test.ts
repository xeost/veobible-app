import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { existingInternalFile } from "./output-files.js";
import { applyVerseOffsets } from "./verse-timing.js";

test("manual offsets migrate from internal and the current layout takes priority", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-output-layout-"));
  const oldFile = path.join(root, "internal", "verse-offsets.json");
  const newFile = path.join(root, "_internal", "2-verse-text-offsets.json");
  const estimates = [{ reference: "John 3:16", text: "God loved the world", start: 0, end: 5 }];
  try {
    await fs.mkdir(path.dirname(oldFile));
    await fs.writeFile(oldFile, JSON.stringify({ verses: [{ reference: "John 3:16", startOffsetSeconds: 0.25, endOffsetSeconds: -0.5 }] }));
    assert.equal(await existingInternalFile(root, "verse-offsets.json"), oldFile);
    const migrated = await applyVerseOffsets(root, true, estimates);
    assert.equal(migrated.cues[0].start, 0.25);
    assert.equal(migrated.cues[0].end, 4.5);
    await fs.mkdir(path.dirname(newFile));
    const previousFile = path.join(root, "_internal", "2-verse-offsets.json");
    await fs.writeFile(previousFile, JSON.stringify({ verses: [{ reference: "John 3:16", startOffsetSeconds: 0.3, endOffsetSeconds: -0.4 }] }));
    assert.equal(await existingInternalFile(root, "verse-offsets.json"), previousFile);
    const previous = await applyVerseOffsets(root, true, estimates);
    assert.equal(previous.cues[0].start, 0.3);
    assert.equal(previous.cues[0].end, 4.6);
    const previousAudioFile = path.join(root, "_internal", "2-offsets.json");
    await fs.writeFile(previousAudioFile, '{"startSeconds": -0.25, "endSeconds": 0.15}');
    assert.equal(await existingInternalFile(root, "offsets.json"), previousAudioFile);
    await fs.writeFile(newFile, JSON.stringify({ verses: [{ reference: "John 3:16", startOffsetSeconds: 0.1, endOffsetSeconds: -0.2 }] }));
    assert.equal(await existingInternalFile(root, "verse-offsets.json"), newFile);
    const current = await applyVerseOffsets(root, true, estimates);
    assert.equal(current.cues[0].start, 0.1);
    assert.equal(current.cues[0].end, 4.8);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
