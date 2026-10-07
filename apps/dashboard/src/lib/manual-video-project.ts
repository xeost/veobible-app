import { z } from "zod";
const identifier = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const point = z.object({
  book: identifier,
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
});
export const manualVideoProjectSchema = z
  .object({
    kind: z.enum(["short", "long"]),
    versionId: z.number().int().positive(),
    slug: identifier,
    title: z.string().trim().min(1).max(500),
    episode: z.number().int().positive().optional(),
    start: point,
    end: point,
  })
  .superRefine((value, ctx) => {
    if (value.kind === "long" && value.episode === undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Episode number is required",
      });
  });
export const bibleBooksSchema = z
  .array(
    z.object({
      id: identifier,
      name: z.string().min(1),
      chapters: z.number().int().positive(),
      versesPerChapter: z.array(z.number().int().positive()),
    }),
  )
  .min(1);
export type BibleBook = z.infer<typeof bibleBooksSchema>[number];
export function validateManualVideoProject(input: unknown, books: BibleBook[]) {
  return manualVideoProjectSchema
    .superRefine((value, ctx) => {
      const indices = [value.start, value.end].map((point) =>
        books.findIndex((book) => book.id === point.book),
      );
      const valid = [value.start, value.end].every((point, index) => {
        const book = books[indices[index]];
        return (
          book &&
          point.chapter <= book.chapters &&
          point.verse <= (book.versesPerChapter[point.chapter - 1] ?? 0)
        );
      });
      if (
        !valid ||
        indices[0] > indices[1] ||
        (indices[0] === indices[1] &&
          (value.start.chapter > value.end.chapter ||
            (value.start.chapter === value.end.chapter &&
              value.start.verse > value.end.verse)))
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid passage boundaries",
        });
    })
    .parse(input);
}
