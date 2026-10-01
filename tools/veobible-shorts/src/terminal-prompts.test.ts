import assert from "node:assert/strict";
import test from "node:test";
import { createNumberedMenu } from "./terminal-prompts.js";

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
