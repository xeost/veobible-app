import { test } from "node:test";
import assert from "node:assert/strict";
import { localModelActions, localModelsSchema } from "./local-models";
const model = (values: Record<string, unknown> = {}) =>
  localModelsSchema.parse({
    checkedAt: new Date().toISOString(),
    models: [
      {
        id: "local-model-1",
        name: "Test model",
        role: "voice",
        uses: [],
        repository: "test/model",
        revision: "a".repeat(40),
        variant: "chatterbox-original",
        software: { name: "chatterbox-tts", version: null },
        status: "downloaded",
        enabled: true,
        ...values,
      },
    ],
  }).models[0];

test("deleted weights offer a download, not resume, enable or repeated deletion", () => {
  const actions = localModelActions(
    model({ status: "incomplete", enabled: false }),
  );
  assert.deepEqual(actions, {
    download: true,
    remove: false,
    downloadLabel: "Download model",
  });
  assert.deepEqual(
    localModelActions(model({ status: "not_downloaded", enabled: false })),
    actions,
  );
  assert.deepEqual(
    localModelActions(model({ status: "downloaded", enabled: false })),
    actions,
  );
});
test("available models offer removal, and only a recorded failed download offers retry", () => {
  assert.equal(localModelActions(model()).download, false);
  assert.equal(localModelActions(model()).remove, true);
  const failed = model({
    status: "incomplete",
    enabled: false,
    download: {
      status: "failed",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    },
  });
  assert.equal(localModelActions(failed).downloadLabel, "Retry download");
  assert.equal(localModelActions(failed).remove, false);
  assert.equal(
    localModelActions(
      model({ status: "custom", repository: null, variant: "custom" }),
    ).download,
    false,
  );
});
