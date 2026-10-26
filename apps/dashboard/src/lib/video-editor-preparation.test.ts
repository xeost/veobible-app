import assert from "node:assert/strict";
import { test } from "node:test";
import {
  nextVideoWaveforms,
  visibleVideoWaveforms,
} from "./video-editor-preparation";

const sections = Array.from({ length: 50 }, (_, index) => `reading-${index}`);
const resources = [
  ...sections.flatMap((section) => [
    {
      section,
      resourceKey: `${section}/original`,
      src: `https://media.example/${section}`,
    },
    {
      section,
      resourceKey: `${section}/generated/1`,
      src: `https://media.example/generated-${section}?revision=1`,
    },
  ]),
  {
    section: "intro",
    resourceKey: "intro/1",
    src: "https://media.example/intro",
  },
];

test("book startup waits only for open sections and their enabled audio tracks", () => {
  assert.deepEqual(visibleVideoWaveforms(resources, new Set()), []);
  assert.deepEqual(
    visibleVideoWaveforms(resources, new Set(["reading-32", "intro"])).map(
      (resource) => resource.resourceKey,
    ),
    ["reading-32/original", "reading-32/generated/1", "intro/1"],
  );
});

test("background preparation starts with the first reading and follows the active section", () => {
  assert.deepEqual(
    nextVideoWaveforms(resources, sections, new Set()),
    resources.slice(0, 2),
  );
  assert.deepEqual(
    nextVideoWaveforms(
      resources,
      sections,
      new Set(["reading-0", "reading-32"]),
      "reading-32",
    ),
    resources.slice(66, 68),
  );
  // A closed selection must not warm an unrelated chapter.
  assert.deepEqual(
    nextVideoWaveforms(resources, sections, new Set(), "reading-32"),
    resources.slice(0, 2),
  );
});

test("prefetch stops at the end, avoids open sections, and tolerates missing recordings", () => {
  assert.deepEqual(
    nextVideoWaveforms(resources, sections, new Set(["reading-49"])),
    [],
  );
  assert.deepEqual(
    nextVideoWaveforms(
      resources,
      sections,
      new Set(["reading-0", "reading-1"]),
      "reading-0",
    ),
    [],
  );
  assert.deepEqual(nextVideoWaveforms([], sections, new Set()), []);
  assert.deepEqual(nextVideoWaveforms(resources, [], new Set()), []);
});
