import { test } from "node:test";
import assert from "node:assert/strict";
import { generationFailureReason } from "./generation-failure.js";

test("disk exhaustion takes priority over the process interruption without exposing diagnostics", () => {
  assert.equal(generationFailureReason(new Error("Voice generation ended with SIGKILL: The volume is out of space")), "disk_full");
  assert.equal(generationFailureReason(new Error("ENOSPC: no space left on device")), "disk_full");
  assert.equal(generationFailureReason(new Error("Voice generation ended with SIGKILL")), "interrupted");
  assert.equal(generationFailureReason(new Error("Private provider diagnostics")), "generation_failed");
});
