import { z } from "zod";

export const publicationFields = [
  "title",
  "episode",
  "reference",
  "version",
  "passage",
  "passage_url",
  "hashtags",
] as const;
export const publicationPlatforms = (kind: "short" | "long" | "book") =>
  kind === "short"
    ? (["instagram", "facebook", "youtube", "tiktok", "x"] as const)
    : (["youtube", "facebook", "tiktok", "x"] as const);
export type PublicationPlatform =
  "instagram" | "facebook" | "youtube" | "tiktok" | "x";
export function validPublicationTemplate(text: string) {
  return !/[{}]/.test(
    text.replace(/\{([^{}]+)\}/g, (token, field: string) =>
      (publicationFields as readonly string[]).includes(field) ? "" : token,
    ),
  );
}
export const publicationTemplatesSchema = z
  .object({
    instagram: z
      .string()
      .max(20000)
      .refine(validPublicationTemplate)
      .optional(),
    facebook: z.string().max(20000).refine(validPublicationTemplate).optional(),
    youtube: z.string().max(20000).refine(validPublicationTemplate).optional(),
    tiktok: z.string().max(20000).refine(validPublicationTemplate).optional(),
    x: z.string().max(20000).refine(validPublicationTemplate).optional(),
  })
  .strict();
export type PublicationTemplates = z.infer<typeof publicationTemplatesSchema>;

/** Replace placeholders once so passage text cannot introduce new substitutions. */
export function fillPublicationTemplate(
  template: string,
  values: Record<(typeof publicationFields)[number], string>,
) {
  if (!validPublicationTemplate(template))
    throw new Error("Invalid publication template placeholders");
  return template.replace(
    /\{([^{}]+)\}/g,
    (_, field: (typeof publicationFields)[number]) => values[field],
  );
}

/** Match the same sections that are exported as individual publication text files. */
export function publicationTemplateSections(template: string) {
  const headings = [
    ...template.matchAll(/^ {0,3}#{1,6}[ \t]+([^\r\n]+)(?:\r?\n|$)/gm),
  ];
  return headings.length
    ? headings.map((heading, index) => {
        const start = heading.index! + heading[0].length;
        const end = headings[index + 1]?.index ?? template.length;
        const prefix =
          index === 0 ? template.slice(0, heading.index).trim() : "";
        return {
          heading: heading[1].trim(),
          template: [prefix, template.slice(start, end).trim()]
            .filter(Boolean)
            .join("\n\n"),
        };
      })
    : [{ heading: "", template }];
}
