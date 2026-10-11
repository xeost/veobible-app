import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeTime } from "./relative-time";

function inTimezone(timezone: string, run: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = timezone;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

test("update labels show calendar days in all interface languages", () => {
  inTimezone("UTC", () => {
    const now = Date.parse("2026-10-10T23:00:00Z");
    assert.equal(relativeTime("2026-10-10T00:01:00Z", "es", now), "Hoy");
    assert.equal(relativeTime("2026-10-09T23:59:00Z", "es", now), "Ayer");
    assert.equal(
      relativeTime("2026-10-08T23:59:00Z", "es", now),
      "Hace 2 días",
    );
    assert.equal(
      relativeTime("2026-10-07T12:00:00Z", "es", now),
      "Hace 3 días",
    );
    assert.equal(relativeTime("2026-10-10T12:00:00Z", "en", now), "Today");
    assert.equal(relativeTime("2026-10-09T12:00:00Z", "en", now), "Yesterday");
    assert.equal(relativeTime("2026-10-08T12:00:00Z", "en", now), "2 days ago");
    assert.equal(relativeTime("2026-10-10T12:00:00Z", "pt", now), "Hoje");
    assert.equal(relativeTime("2026-10-09T12:00:00Z", "pt", now), "Ontem");
    assert.equal(relativeTime("2026-10-08T12:00:00Z", "pt", now), "Há 2 dias");
    assert.equal(
      relativeTime("2026-09-01T12:00:00Z", "es", now),
      "Hace 39 días",
    );
    assert.equal(relativeTime(null, "es", now), "");
    assert.equal(relativeTime("invalid", "es", now), "");
  });
});

test("yesterday begins at local midnight, even when only minutes have elapsed", () => {
  inTimezone("America/Argentina/Cordoba", () => {
    const now = Date.parse("2026-10-11T03:05:00Z");
    assert.equal(relativeTime("2026-10-11T02:55:00Z", "es", now), "Ayer");
    assert.equal(relativeTime("2026-10-11T03:01:00Z", "es", now), "Hoy");
    assert.equal(
      relativeTime(
        "2026-01-01T02:55:00Z",
        "es",
        Date.parse("2026-01-01T03:05:00Z"),
      ),
      "Ayer",
    );
  });
});

test("daylight-saving transitions do not change the number of calendar days", () => {
  inTimezone("America/New_York", () => {
    const now = Date.parse("2026-03-09T04:05:00Z");
    assert.equal(relativeTime("2026-03-08T05:05:00Z", "en", now), "Yesterday");
    assert.equal(relativeTime("2026-03-07T05:05:00Z", "en", now), "2 days ago");
    assert.equal(
      relativeTime(
        "2026-11-01T04:05:00Z",
        "en",
        Date.parse("2026-11-02T05:05:00Z"),
      ),
      "Yesterday",
    );
  });
});
