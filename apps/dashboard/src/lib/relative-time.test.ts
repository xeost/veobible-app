import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeTime } from "./relative-time";

test("project update ages support all interface languages and missing timestamps", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  assert.equal(relativeTime("2026-10-09T12:00:00Z", "es", now), "ayer");
  assert.equal(relativeTime("2026-10-07T12:00:00Z", "es", now), "hace 3 días");
  assert.equal(relativeTime("2026-10-10T07:00:00Z", "es", now), "hace 5 horas");
  assert.equal(relativeTime("2026-10-09T12:00:00Z", "en", now), "yesterday");
  assert.equal(relativeTime("2026-10-09T12:00:00Z", "pt", now), "ontem");
  assert.equal(relativeTime("2026-10-10T12:00:00Z", "es", now), "ahora");
  assert.equal(relativeTime(null, "es", now), "");
  assert.equal(relativeTime("invalid", "es", now), "");
});
