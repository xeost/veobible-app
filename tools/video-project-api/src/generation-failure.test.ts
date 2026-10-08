import { test } from "node:test";
import assert from "node:assert/strict";
import { generationFailureReason } from "./generation-failure.js";

test("disk exhaustion takes priority over the process interruption without exposing diagnostics", () => {
  assert.equal(generationFailureReason(new Error("Voice generation ended with SIGKILL: The volume is out of space")), "disk_full");
  assert.equal(generationFailureReason(new Error("ENOSPC: no space left on device")), "disk_full");
  assert.equal(generationFailureReason(new Error("Voice generation ended with SIGKILL")), "interrupted");
  assert.equal(generationFailureReason(new Error("Private provider diagnostics")), "generation_failed");
});

test("supervisor failures expose only a safe reason", () => {
  assert.equal(generationFailureReason(new Error("VOICE_RESOURCE_LIMIT: private process details")), "resource_limit");
  assert.equal(generationFailureReason(new Error("MPS backend out of memory")), "resource_limit");
  assert.equal(generationFailureReason(new Error("VOICE_TIMEOUT: private process details")), "timeout");
  assert.equal(generationFailureReason(new Error("VOICE_BUSY: private process details")), "voice_busy");
});
