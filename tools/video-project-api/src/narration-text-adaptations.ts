import { z } from "zod";

export const narrationTextAdaptationsSchema = z
  .object({
    reinforceSpanishRs: z.boolean().default(false),
  })
  .strict();
export type NarrationTextAdaptations = z.infer<
  typeof narrationTextAdaptationsSchema
>;

/** Remove only known editorial markers; punctuation and Unicode letters stay intact.
 * Paragraph marks separate words, while single angle quotes wrap existing text.
 * Keep line breaks because the speech worker uses them to separate verses.
 */
export function cleanNarrationText(text: string) {
  if (!/[¶‹›]/u.test(text)) return text;
  return text
    .replace(/[‹›]/gu, "")
    .replace(/^[ \t]*¶(?:[ \t]*¶)*[ \t]*/gmu, "")
    .replace(/[ \t]*¶(?:[ \t]*¶)*[ \t]*/gu, " ")
    .trim();
}

/** Apply once to the spoken script, never to Bible text or saved editor text. */
export function adaptNarrationText(
  text: string,
  locale: string,
  adaptations?: NarrationTextAdaptations,
) {
  text = cleanNarrationText(text);
  if (locale !== "es" || !adaptations?.reinforceSpanishRs) return text;
  return text.replace(/rr|(?<![\p{L}\p{M}\p{N}_])[rR]/gu, (match) =>
    match === "rr" ? "rrr" : match === "R" ? "Rr" : "rr",
  );
}
