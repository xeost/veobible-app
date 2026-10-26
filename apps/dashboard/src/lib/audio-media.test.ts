import assert from "node:assert/strict";
import { test } from "node:test";
import { audioMediaUrl } from "./audio-media";
import { waveformCacheKey } from "./waveform-cache";

test("direct audio links preserve the grant, file, revision and stable waveform identity across renewal", () => {
  const access = {
    base: "https://proxy.example/v1/audio-projects/rv1909-v2/genesis/",
    query:
      "outputEnvironment=production&order=1&chapterCount=50&mediaToken=first",
    expiresAt: 1,
  };
  const first = audioMediaUrl(
    access,
    1,
    2,
    "rev-one",
    "genesis/1-2-rev-one/intro.wav",
  );
  const parsed = new URL(first);
  assert.equal(parsed.pathname, "/v1/audio-projects/rv1909-v2/genesis/media");
  assert.equal(
    parsed.searchParams.get("file"),
    "genesis/1-2-rev-one/intro.wav",
  );
  assert.equal(parsed.searchParams.get("verse"), "2");
  assert.equal(parsed.searchParams.get("mediaToken"), "first");
  const renewed = audioMediaUrl(
    { ...access, query: access.query.replace("first", "renewed") },
    1,
    2,
    "rev-one",
    "genesis/1-2-rev-one/intro.wav",
  );
  assert.equal(
    waveformCacheKey(first, "verse"),
    waveformCacheKey(renewed, "verse"),
  );
  const original = new URL(
    audioMediaUrl(access, 1, undefined, "original-rev", undefined, true),
  );
  assert.ok(original.pathname.endsWith("/original-media"));
  assert.equal(original.searchParams.get("revision"), "original-rev");
  assert.equal(original.searchParams.has("file"), false);
  assert.equal(original.searchParams.has("verse"), false);
  assert.equal(
    new URL(
      audioMediaUrl(access, 1, undefined, "final", "01-genesis-1.mp3"),
    ).searchParams.get("file"),
    "01-genesis-1.mp3",
  );
});
