import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampProgress,
  samplingProgress,
  voiceStageProgress,
} from "./generation-progress";
test("local speech progress follows model stages and the latest sampling percentage", () => {
  assert.equal(voiceStageProgress("Loading model"), 10);
  assert.equal(voiceStageProgress("Generating voice"), 20);
  assert.equal(voiceStageProgress("Converting voice"), 95);
  assert.equal(samplingProgress("warning without progress"), undefined);
  assert.equal(samplingProgress("Sampling: 10%|xx\rSampling: 50%|xxxxx"), 55);
  assert.equal(samplingProgress("100%|full"), 90);
  assert.equal(samplingProgress("101%|full"), 90);
  assert.equal(clampProgress(NaN), 0);
  assert.equal(clampProgress(-10), 0);
  assert.equal(voiceStageProgress("Generating voice fragment 3/7"), 40);
  assert.equal(
    samplingProgress("50%|half", "Generating voice fragment 3/7"),
    45,
  );
  assert.equal(
    samplingProgress("100%|full", "Generating voice fragment 7/7"),
    90,
  );
});
