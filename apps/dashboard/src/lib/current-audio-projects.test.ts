import { test } from "node:test";
import assert from "node:assert/strict";
import type { AudioCatalogRow } from "./audio-listing";
import {
  advanceCurrentAudioProject,
  parseCurrentAudioProjects,
  toggleCurrentAudioProject,
} from "./current-audio-projects";
const row = (id: number, code = "rv1909", edition = "rv1909-v2") =>
  ({
    id,
    edition,
    version: { locale: "es", code },
  }) as AudioCatalogRow;
test("audio marks allow two per Bible version across editions and preserve other marks", () => {
  const first = toggleCurrentAudioProject({}, row(1));
  const second = toggleCurrentAudioProject(
    first,
    row(2, "rv1909", "rv1909-v3"),
  );
  assert.deepEqual(second, { "es:rv1909": [1, 2] });
  assert.equal(toggleCurrentAudioProject(second, row(3)), second);
  const other = toggleCurrentAudioProject(second, row(4, "other"));
  const removed = toggleCurrentAudioProject(other, row(1));
  assert.deepEqual(removed, { "es:rv1909": [2], "es:other": [4] });
  assert.deepEqual(
    toggleCurrentAudioProject(removed, row(3))["es:rv1909"],
    [2, 3],
  );
});
test("stored audio marks reject invalid data, deduplicate and enforce the limit", () => {
  assert.deepEqual(parseCurrentAudioProjects("broken"), {});
  assert.deepEqual(parseCurrentAudioProjects("[1,2]"), {});
  assert.deepEqual(
    parseCurrentAudioProjects('{"es:rv1909":[1,1,-1,"2",2,3]}'),
    { "es:rv1909": [1, 2] },
  );
});

test("advancing an audio mark preserves the second mark and rejects stale or mismatched advances", () => {
  const marks = { "es:rv1909": [1, 2] };
  const next = advanceCurrentAudioProject(marks, row(1), row(3));
  assert.deepEqual(next, { "es:rv1909": [3, 2] });
  assert.equal(advanceCurrentAudioProject(marks, row(1), row(2)), marks);
  assert.equal(advanceCurrentAudioProject(next, row(1), row(4)), next);
  assert.equal(
    advanceCurrentAudioProject(marks, row(1), row(3, "other")),
    marks,
  );
  assert.equal(
    advanceCurrentAudioProject(marks, row(1), row(3, "rv1909", "rv1909-v3")),
    marks,
  );
  assert.deepEqual(advanceCurrentAudioProject(next, row(2), row(4)), {
    "es:rv1909": [3, 4],
  });
});
