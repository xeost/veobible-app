import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateManualVideoProject,
  manualVideoProjectSchema,
} from "./manual-video-project";
const books = [
  { id: "genesis", name: "Génesis", chapters: 2, versesPerChapter: [31, 25] },
  { id: "exodus", name: "Éxodo", chapters: 2, versesPerChapter: [22, 25] },
];
const input = {
  kind: "short",
  versionId: 1,
  slug: "custom-passage",
  title: "Custom title",
  start: { book: "genesis", chapter: 1, verse: 30 },
  end: { book: "exodus", chapter: 1, verse: 2 },
};
test("manual project validation accepts custom passages and checks version-specific boundaries and order", () => {
  assert.equal(validateManualVideoProject(input, books).slug, "custom-passage");
  for (const end of [
    { book: "unknown", chapter: 1, verse: 1 },
    { book: "exodus", chapter: 3, verse: 1 },
    { book: "exodus", chapter: 1, verse: 23 },
    { book: "genesis", chapter: 1, verse: 29 },
  ])
    assert.throws(() => validateManualVideoProject({ ...input, end }, books));
  assert.throws(() =>
    validateManualVideoProject(
      {
        ...input,
        start: { book: "exodus", chapter: 1, verse: 1 },
        end: { book: "genesis", chapter: 2, verse: 2 },
      },
      books,
    ),
  );
  assert.equal(
    manualVideoProjectSchema.safeParse({ ...input, kind: "long" }).success,
    false,
  );
  assert.equal(
    validateManualVideoProject({ ...input, kind: "long", episode: 33 }, books)
      .episode,
    33,
  );
  assert.equal(
    manualVideoProjectSchema.safeParse({ ...input, slug: "../unsafe" }).success,
    false,
  );
  assert.equal(
    manualVideoProjectSchema.safeParse({ ...input, title: " " }).success,
    false,
  );
});
