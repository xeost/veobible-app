import { z } from "zod";

export const narrationTextAdaptationsSchema = z
  .object({
    reinforceSpanishRs: z.boolean().default(false),
  })
  .strict();
export type NarrationTextAdaptations = z.infer<
  typeof narrationTextAdaptationsSchema
>;

/** Apply once to the spoken script, never to Bible text or saved editor text. */
export function adaptNarrationText(
  text: string,
  locale: string,
  adaptations?: NarrationTextAdaptations,
) {
  if (locale !== "es" || !adaptations?.reinforceSpanishRs) return text;
  return text.replace(/rr|(?<![\p{L}\p{M}\p{N}_])[rR]/gu, (match) =>
    match === "rr" ? "rrr" : match === "R" ? "Rr" : "rr",
  );
}
