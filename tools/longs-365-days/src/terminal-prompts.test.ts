import assert from "node:assert/strict";
import test from "node:test";
import { createNumberedMenu } from "./terminal-prompts.js";
import { nextMenuIndex } from "./numbered-select.js";

test("Back clears the menu's previous selection, including timing editor navigation", async () => {
  for (const value of ["back", "cancel", "audio"]) {
    const defaults: Array<string | undefined> = [];
    const replies = ["edit", value, "first"];
    const choose = createNumberedMenu(async menu => { defaults.push(menu.default); return replies.shift()!; });
    const choices = [{ name: "First", value: "first" }, { name: "Edit", value: "edit" }, { name: "Back", value, remember: false }];
    for (let visit = 0; visit < 3; visit++) await choose("menu", { message: "Menu", choices });
    assert.deepEqual(defaults, [undefined, "edit", undefined]);
  }
});

test("cursor wraps at both ends while preserving choice positions and skipping unavailable options", () => {
  const choices = ["a", "b", "c", "d"].map(value => ({ name: value, value, disabled: value === "b" }));
  assert.equal(nextMenuIndex(choices, 0, -1), 3);
  assert.equal(nextMenuIndex(choices, 3, 1), 0);
  assert.equal(nextMenuIndex(choices, 0, 1), 2);
  assert.deepEqual(choices.map(choice => choice.value), ["a", "b", "c", "d"]);
});

test("forgetting a used passage returns selection to the first reordered passage without resetting other menus", async () => {
  const defaults: Array<string | undefined> = [];
  const replies = ["used", "volume", "next", "volume"];
  const choose = createNumberedMenu(async menu => { defaults.push(menu.default); return replies.shift()!; });
  const choices = ["used", "next"].map(value => ({ name: value, value }));
  await choose("passages/es-version", { message: "Passages", choices });
  await choose("actions", { message: "Actions", choices: [{ name: "Volume", value: "volume" }] });
  choose.forget("passages/es-version");
  await choose("passages/es-version", { message: "Passages", choices: [...choices].reverse() });
  await choose("actions", { message: "Actions", choices: [{ name: "Volume", value: "volume" }] });
  assert.deepEqual(defaults, [undefined, undefined, undefined, "volume"]);
});

test("menus remember values independently across changing labels, order and available actions", async () => {
  const defaults: Array<string | undefined> = [];
  const replies = ["b", "a", "b", "c", "b", "a", "a"];
  let cancelled = false;
  const choose = createNumberedMenu(async menu => {
    defaults.push(menu.default);
    if (cancelled) throw new Error("cancelled");
    return replies.shift()!;
  });
  const choices = ["a", "b", "c"].map(value => ({ name: value, value }));
  await choose("audio", { message: "Audio", choices });
  await choose("verses", { message: "Verses", choices });
  await choose("audio", { message: "Audio with new offsets", choices: [...choices].reverse() });
  await choose("audio", { message: "Different actions", choices: choices.filter(choice => choice.value !== "b") });
  await choose("audio", { message: "Disabled action", choices: choices.map(choice => ({ ...choice, disabled: choice.value === "c" })) });
  cancelled = true;
  await assert.rejects(choose("audio", { message: "Audio", choices }), /cancelled/);
  cancelled = false;
  await choose("audio", { message: "Audio again", choices });
  assert.deepEqual(defaults, [undefined, undefined, "b", undefined, undefined, "b", "b"]);
  // Changes in other menus and cancelled prompts do not replace a saved selection.
  await choose("verses", { message: "Verses again", choices });
  assert.equal(defaults.at(-1), "a");
});
