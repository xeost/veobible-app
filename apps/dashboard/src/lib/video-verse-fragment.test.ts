import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVideoVerseFragment,
  videoVerseFragment,
} from "./video-verse-fragment";

test("video verse fragments restore the verse and reading block within the project", () => {
  const targets = [
    { section: 0, reference: "Génesis 1:10" },
    { section: 0, reference: "Génesis 1:11" },
    { section: 1, reference: "Génesis 2:1" },
  ];
  assert.equal(videoVerseFragment(targets[0], targets), "#1-10");
  for (const target of targets)
    assert.deepEqual(
      parseVideoVerseFragment(videoVerseFragment(target, targets)!, targets),
      target,
    );
  for (const fragment of ["#1-1", "#1-12", "#2-2", "#0-1", "#1-10-extra", ""])
    assert.equal(parseVideoVerseFragment(fragment, targets), null);
});

test("verses with the same numbers in different books have unambiguous links", () => {
  const targets = [
    { section: 0, reference: "Génesis 1:1" },
    { section: 1, reference: "Éxodo 1:1" },
    { section: 1, reference: "Éxodo 1:2" },
  ];
  assert.equal(videoVerseFragment(targets[0], targets), "#reading-1-1-1");
  assert.equal(videoVerseFragment(targets[1], targets), "#reading-2-1-1");
  assert.equal(videoVerseFragment(targets[2], targets), "#1-2");
  for (const target of targets)
    assert.deepEqual(
      parseVideoVerseFragment(videoVerseFragment(target, targets)!, targets),
      target,
    );
  assert.equal(parseVideoVerseFragment("#1-1", targets), null);
});
