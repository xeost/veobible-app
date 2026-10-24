import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  changeVisualShortcut,
  loadVisualShortcuts,
  visualShortcutInputSchema,
  visualShortcutKindSchema,
  elementFromShortcut,
  type VisualShortcut,
} from "./visual-shortcuts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    "CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)",
  );
  let beforeWrite: (() => void) | undefined;
  const database = {
    prepare: (sql: string) => ({
      bind: (...args: any[]) => ({
        first: async () => sqlite.prepare(sql).get(...args) ?? null,
        run: async () => {
          beforeWrite?.();
          beforeWrite = undefined;
          const result = sqlite.prepare(sql).run(...args);
          return { meta: { changes: result.changes } };
        },
      }),
    }),
  } as unknown as D1Database;
  return {
    sqlite,
    database,
    race: (action: () => void) => {
      beforeWrite = action;
    },
  };
}
const configured = {
  name: "Lower left",
  element: {
    template: "social-button" as const,
    moment: "late" as const,
    positionMode: "coordinates" as const,
    verticalPosition: "bottom" as const,
    horizontalPosition: "left" as const,
    offsetsEnabled: true,
    verticalOffset: -3.5,
    horizontalOffset: 2,
    hidden: false,
    id: "source-element",
    references: ["John 3:16"],
  },
};

test("shortcuts persist by format and support independent renaming, editing and removal", async () => {
  const { sqlite, database } = fixture();
  try {
    assert.deepEqual(await loadVisualShortcuts(database, "short"), []);
    assert.equal(
      sqlite.prepare("SELECT count(*) n FROM site_settings").get()!.n,
      0,
    );
    const [shortcut] = await changeVisualShortcut(
      database,
      "short",
      "add",
      configured,
    );
    assert.equal(shortcut.name, "Lower left");
    assert.equal(shortcut.element.template, "social-button");
    assert.equal("references" in shortcut.element, false);
    assert.equal("id" in shortcut.element, false);
    assert.deepEqual(await loadVisualShortcuts(database, "short"), [shortcut]);
    assert.deepEqual(await loadVisualShortcuts(database, "long"), []);
    await changeVisualShortcut(database, "book", "add", configured);
    const [edited] = await changeVisualShortcut(
      database,
      "short",
      "update",
      {
        name: "Top right",
        element: {
          ...configured.element,
          verticalPosition: "top",
          horizontalPosition: "right",
        },
      },
      shortcut.id,
    );
    assert.equal(edited.id, shortcut.id);
    assert.equal(edited.name, "Top right");
    assert.equal(
      edited.element.template === "social-button" &&
        edited.element.verticalPosition,
      "top",
    );
    assert.equal(
      (await loadVisualShortcuts(database, "book"))[0].name,
      "Lower left",
    );
    assert.deepEqual(
      await changeVisualShortcut(
        database,
        "short",
        "remove",
        undefined,
        shortcut.id,
      ),
      [],
    );
    await assert.rejects(
      changeVisualShortcut(database, "short", "remove", undefined, shortcut.id),
      /no longer available/,
    );
  } finally {
    sqlite.close();
  }
});

test("adding from a shortcut preserves configuration with fresh identities and current section references", () => {
  const shortcut: VisualShortcut = {
    id: crypto.randomUUID(),
    ...visualShortcutInputSchema.parse(configured),
  };
  const added = elementFromShortcut(shortcut, ["Genesis 1:1"]);
  const second = elementFromShortcut(shortcut);
  assert.notEqual(added.id, second.id);
  assert.deepEqual(added.references, ["Genesis 1:1"]);
  assert.equal(second.references, undefined);
  if (added.template !== "social-button") throw new Error("Wrong template");
  assert.equal(added.verticalOffset, -3.5);
  assert.equal(added.horizontalPosition, "left");
  assert.equal(added.moment, "late");
  added.horizontalOffset = 99;
  assert.equal(
    shortcut.element.template === "social-button" &&
      shortcut.element.horizontalOffset,
    2,
  );
  const youtube = visualShortcutInputSchema.parse({
    name: "Subscribe",
    element: {
      template: "youtube-subscribe",
      label: "Join",
      subscribedLabel: "Joined",
      startSeconds: 12,
      durationSeconds: 3,
      hidden: true,
    },
  });
  const copy = elementFromShortcut({ ...youtube, id: crypto.randomUUID() });
  assert.equal(copy.template === "youtube-subscribe" && copy.label, "Join");
  assert.equal(copy.hidden, true);
});

test("shortcut validation rejects invalid configuration, unsupported formats and excessive names", () => {
  assert.equal(visualShortcutKindSchema.safeParse("audio").success, false);
  assert.equal(
    visualShortcutInputSchema.safeParse({ ...configured, name: " " }).success,
    false,
  );
  assert.equal(
    visualShortcutInputSchema.safeParse({ ...configured, name: "x".repeat(81) })
      .success,
    false,
  );
  assert.equal(
    visualShortcutInputSchema.safeParse({
      ...configured,
      element: { ...configured.element, verticalOffset: 101 },
    }).success,
    false,
  );
});

test("concurrent shortcut saves never overwrite another window's changes", async () => {
  const { sqlite, database, race } = fixture();
  try {
    const [saved] = await changeVisualShortcut(
      database,
      "short",
      "add",
      configured,
    );
    const other = { ...saved, name: "Changed elsewhere" };
    race(() =>
      sqlite
        .prepare("UPDATE site_settings SET value=? WHERE key=?")
        .run(JSON.stringify([other]), "visual_element_shortcuts:short"),
    );
    await assert.rejects(
      changeVisualShortcut(database, "short", "update", configured, saved.id),
      /another window/,
    );
    assert.equal(
      (await loadVisualShortcuts(database, "short"))[0].name,
      "Changed elsewhere",
    );
  } finally {
    sqlite.close();
  }
});

test("shortcut ordering persists by format without changing configurations or boundary items", async () => {
  const { sqlite, database } = fixture();
  try {
    const [first] = await changeVisualShortcut(
      database,
      "short",
      "add",
      configured,
    );
    const [, second] = await changeVisualShortcut(database, "short", "add", {
      ...configured,
      name: "Second",
    });
    const [, , third] = await changeVisualShortcut(database, "short", "add", {
      ...configured,
      name: "Third",
    });
    const book = await changeVisualShortcut(
      database,
      "book",
      "add",
      configured,
    );
    const moved = await changeVisualShortcut(
      database,
      "short",
      "move",
      { direction: "up" },
      third.id,
    );
    assert.deepEqual(moved, [first, third, second]);
    assert.deepEqual(await loadVisualShortcuts(database, "short"), moved);
    assert.deepEqual(await loadVisualShortcuts(database, "book"), book);
    assert.deepEqual(
      await changeVisualShortcut(
        database,
        "short",
        "move",
        { direction: "up" },
        first.id,
      ),
      moved,
    );
    assert.deepEqual(
      await changeVisualShortcut(
        database,
        "short",
        "move",
        { direction: "down" },
        second.id,
      ),
      moved,
    );
    assert.deepEqual(
      await changeVisualShortcut(
        database,
        "short",
        "move",
        { direction: "down" },
        first.id,
      ),
      [third, first, second],
    );
    await assert.rejects(
      changeVisualShortcut(
        database,
        "short",
        "move",
        { direction: "left" },
        first.id,
      ),
    );
    await assert.rejects(
      changeVisualShortcut(
        database,
        "short",
        "move",
        { direction: "up" },
        crypto.randomUUID(),
      ),
      /no longer available/,
    );
  } finally {
    sqlite.close();
  }
});

test("format shortcut limits are enforced without changing the saved list", async () => {
  const { sqlite, database } = fixture();
  try {
    for (let index = 0; index < 32; index++)
      await changeVisualShortcut(database, "long", "add", configured);
    await assert.rejects(
      changeVisualShortcut(database, "long", "add", configured),
      /up to 32/,
    );
    assert.equal((await loadVisualShortcuts(database, "long")).length, 32);
  } finally {
    sqlite.close();
  }
});
