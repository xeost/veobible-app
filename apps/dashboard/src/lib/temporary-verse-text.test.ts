import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialVerseText,
  temporaryVerseText,
  verseTextOverride,
} from "./temporary-verse-text";

test("accepted text stays available for repeated regenerations of the active verse", () => {
  let state = initialVerseText("rv1909-v2/genesis/1:1", "Original verse.");
  state = temporaryVerseText(state, { type: "edit" });
  state = temporaryVerseText(state, {
    type: "change",
    text: "  Pronunciation adaptation.  ",
  });
  assert.equal(
    verseTextOverride(state),
    undefined,
    "unaccepted drafts never reach synthesis",
  );
  state = temporaryVerseText(state, { type: "accept" });
  assert.equal(state.draft, null);
  assert.equal(state.accepted, "Pronunciation adaptation.");
  for (let generation = 0; generation < 3; generation++) {
    assert.equal(verseTextOverride(state), "Pronunciation adaptation.");
    state = temporaryVerseText(state, {
      type: "select",
      scope: state.scope,
      original: state.original,
    });
  }
  state = temporaryVerseText(state, { type: "edit" });
  assert.equal(state.draft, state.accepted);
  state = temporaryVerseText(state, {
    type: "change",
    text: "Unaccepted change.",
  });
  state = temporaryVerseText(state, { type: "cancel" });
  assert.equal(state.accepted, "Pronunciation adaptation.");
});

test("restoring the original works while editing or displaying accepted text", () => {
  let state = initialVerseText("1:1", "Original verse.");
  state = temporaryVerseText(state, { type: "edit" });
  state = temporaryVerseText(state, { type: "change", text: "Adapted verse." });
  state = temporaryVerseText(state, { type: "restore" });
  assert.equal(state.draft, "Original verse.");
  assert.equal(verseTextOverride(state), undefined);
  state = temporaryVerseText(state, { type: "change", text: "Adapted verse." });
  state = temporaryVerseText(state, { type: "accept" });
  state = temporaryVerseText(state, { type: "restore" });
  assert.equal(state.draft, null);
  assert.equal(state.accepted, "Original verse.");
  assert.equal(verseTextOverride(state), undefined);
});

test("switching verses, leaving the active verse, and reloading discard temporary text", () => {
  let state = initialVerseText("book/1:1", "Original.");
  state = temporaryVerseText(state, { type: "edit" });
  state = temporaryVerseText(state, { type: "change", text: "Adapted." });
  state = temporaryVerseText(state, { type: "accept" });
  const next = temporaryVerseText(state, {
    type: "select",
    scope: "book/1:2",
    original: "Next verse.",
  });
  assert.equal(verseTextOverride(next), undefined);
  assert.equal(next.draft, null);
  assert.equal(
    verseTextOverride(temporaryVerseText(state, { type: "discard" })),
    undefined,
  );
  assert.equal(
    verseTextOverride(initialVerseText(state.scope, state.original)),
    undefined,
  );
});

test("blank drafts cannot replace previously accepted pronunciation text", () => {
  let state = initialVerseText("1:1", "Original.");
  state = temporaryVerseText(state, { type: "edit" });
  state = temporaryVerseText(state, { type: "change", text: "Adapted." });
  state = temporaryVerseText(state, { type: "accept" });
  state = temporaryVerseText(state, { type: "edit" });
  state = temporaryVerseText(state, { type: "change", text: "   " });
  state = temporaryVerseText(state, { type: "accept" });
  assert.equal(state.draft, "   ");
  assert.equal(verseTextOverride(state), "Adapted.");
});
