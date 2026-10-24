import { z } from "zod";
import {
  visualElementSchema,
  type VisualElement,
} from "../../../../tools/video-project-api/src/visual-elements";

export const visualShortcutKindSchema = z.enum(["short", "long", "book"]);
export type VisualShortcutKind = z.infer<typeof visualShortcutKindSchema>;
export const visualShortcutInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    element: visualElementSchema.transform(
      ({ id: _id, references: _references, ...element }) => element,
    ),
  })
  .strict();
export const visualShortcutSchema = visualShortcutInputSchema.extend({
  id: z.string().uuid(),
});
export const visualShortcutsSchema = z.array(visualShortcutSchema).max(32);
export type VisualShortcut = z.infer<typeof visualShortcutSchema>;

export function elementFromShortcut(
  shortcut: VisualShortcut,
  references?: string[],
): VisualElement {
  return visualElementSchema.parse({
    ...structuredClone(shortcut.element),
    id: crypto.randomUUID(),
    ...(references ? { references: [...references] } : {}),
  });
}

export class VisualShortcutError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const key = (kind: VisualShortcutKind) => `visual_element_shortcuts:${kind}`;

async function storedShortcuts(database: D1Database, kind: VisualShortcutKind) {
  return database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(key(kind))
    .first<{ value: string }>();
}
export async function loadVisualShortcuts(
  database: D1Database,
  kind: VisualShortcutKind,
) {
  const row = await storedShortcuts(database, kind);
  return row ? visualShortcutsSchema.parse(JSON.parse(row.value)) : [];
}
export async function changeVisualShortcut(
  database: D1Database,
  kind: VisualShortcutKind,
  operation: "add" | "update" | "remove" | "move",
  input?: unknown,
  id?: string,
) {
  const row = await storedShortcuts(database, kind);
  const items = row ? visualShortcutsSchema.parse(JSON.parse(row.value)) : [];
  if (operation !== "add" && !items.some((item) => item.id === id))
    throw new VisualShortcutError(
      "This shortcut is no longer available. Reload the page to continue.",
      404,
    );
  if (operation === "add" && items.length >= 32)
    throw new VisualShortcutError(
      "You can save up to 32 shortcuts per format. Remove a shortcut before adding another.",
      400,
    );
  const next =
    operation === "remove"
      ? items.filter((item) => item.id !== id)
      : operation === "add"
        ? [
            ...items,
            {
              ...visualShortcutInputSchema.parse(input),
              id: crypto.randomUUID(),
            },
          ]
        : operation === "move"
          ? [...items]
          : items.map((item) =>
              item.id === id
                ? { ...visualShortcutInputSchema.parse(input), id: item.id }
                : item,
            );
  if (operation === "move") {
    const { direction } = z
      .object({ direction: z.enum(["up", "down"]) })
      .strict()
      .parse(input);
    const index = next.findIndex((item) => item.id === id);
    const target = index + (direction === "up" ? -1 : 1);
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
  }
  const parsed = visualShortcutsSchema.parse(next);
  const result = await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE site_settings.value=?",
    )
    .bind(
      key(kind),
      JSON.stringify(parsed),
      new Date().toISOString(),
      row?.value ?? null,
    )
    .run();
  if (!result.meta.changes)
    throw new VisualShortcutError(
      "The shortcuts changed in another window. Reload the page before saving again.",
      409,
    );
  return parsed;
}
