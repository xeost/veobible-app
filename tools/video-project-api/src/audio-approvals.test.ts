import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audioVerseApproval,
  isAudioVerseApproved,
  audioMixSettingsChanged,
} from "./audio-approvals.js";
import type { AudioSettings, AudioProject } from "./audio-project-schema.js";

test("approval identifies the exact recording and audible trim, including full recordings", () => {
  const project: Pick<AudioProject, "recordings"> = {
    recordings: {
      "1:1": { file: "jude/verse.wav", duration: 2, revision: "first" },
    },
  };
  const settings: AudioSettings = { baseVoice: "es-1", trims: {}, pauses: {} };
  assert.equal(isAudioVerseApproved(project, settings, "1:1"), false);
  assert.equal(audioVerseApproval(project, settings, "1:2"), undefined);
  const full = audioVerseApproval(project, settings, "1:1")!;
  assert.deepEqual(full.trim, { startSeconds: 0, endSeconds: 2 });
  settings.approvals = { "1:1": full };
  assert.equal(isAudioVerseApproved(project, settings, "1:1"), true);
  settings.trims["1:1"] = { startSeconds: 0.2, endSeconds: 1.8 };
  assert.equal(isAudioVerseApproved(project, settings, "1:1"), false);
  settings.approvals["1:1"] = audioVerseApproval(project, settings, "1:1")!;
  assert.equal(isAudioVerseApproved(project, settings, "1:1"), true);
  settings.trims["1:1"] = { startSeconds: 0.3, endSeconds: 1.8 };
  assert.equal(isAudioVerseApproved(project, settings, "1:1"), false);
  settings.trims["1:1"] = { startSeconds: 0.2, endSeconds: 1.8 };
  project.recordings["1:1"].revision = "regenerated";
  assert.equal(isAudioVerseApproved(project, settings, "1:1"), false);
  delete project.recordings["1:1"];
  assert.equal(isAudioVerseApproved(project, settings, "1:1"), false);
});

test("review metadata does not change audio mixes but trim changes do", () => {
  const settings: AudioSettings = { baseVoice: "es-1", trims: {}, pauses: {} };
  const approval = {
    recordingRevision: "first",
    trim: { startSeconds: 0, endSeconds: 2 },
  };
  assert.equal(
    audioMixSettingsChanged(settings, {
      ...settings,
      approvals: { "1:1": approval },
    }),
    false,
  );
  assert.equal(
    audioMixSettingsChanged(settings, {
      ...settings,
      trims: { "1:1": approval.trim },
    }),
    true,
  );
  assert.equal(
    audioMixSettingsChanged(settings, { ...settings, pauses: { "1:1": 0.8 } }),
    true,
  );
});
