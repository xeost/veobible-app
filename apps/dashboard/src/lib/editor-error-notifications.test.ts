import assert from "node:assert/strict";
import { test } from "node:test";
import { changedEditorErrors } from "./editor-error-notifications";

test("persistent generation errors notify once across progress polls and rerenders", () => {
  const failed = { generation: "Audio generation could not be completed." };
  assert.deepEqual(changedEditorErrors({}, failed), [failed.generation]);
  assert.deepEqual(changedEditorErrors(failed, { ...failed }), []);
  assert.deepEqual(changedEditorErrors(failed, { generation: false }), []);
  assert.deepEqual(changedEditorErrors({ generation: false }, failed), [
    failed.generation,
  ]);
});

test("new jobs and changed failure reasons notify again without duplicating simultaneous messages", () => {
  const message = "Could not generate narration.";
  assert.deepEqual(
    changedEditorErrors(
      { "voice:intro:old": message },
      { "voice:intro:new": message },
    ),
    [message],
  );
  assert.deepEqual(
    changedEditorErrors(
      { playback: "Could not play" },
      { playback: "Unavailable" },
    ),
    ["Unavailable"],
  );
  assert.deepEqual(
    changedEditorErrors(
      {},
      {
        intro: message,
        outro: message,
        analysis: "Could not analyze",
        request: "",
        pending: false,
      },
    ),
    [message, "Could not analyze"],
  );
});
