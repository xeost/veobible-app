import { z } from "zod";
import {
  narrationPresets,
  narrationStylesSchema,
  narrationParametersSchema,
  resolveNarrationStyle,
  type NarrationStyles,
} from "../../../../tools/video-project-api/src/narration-parameters";

export const builtInNarrationLabels = {
  natural: "Natural narration",
  expressive: "Expressive narration",
  relaxed: "Slower voice",
} as const;
export type NarrationLocale = "en" | "es" | "pt";
export const customNarrationPresetSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(100)
      .refine((id) => !Object.hasOwn(narrationPresets, id)),
    name: z.string().trim().min(1).max(80),
    // Keep storage independent of the parameters supported by today's voice model.
    settings: z.record(z.string(), z.unknown()),
  })
  .strict();
export type CustomNarrationPreset = z.infer<typeof customNarrationPresetSchema>;
const languagePresetsSchema = z
  .object({
    selected: z.string(),
    items: z.array(customNarrationPresetSchema).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.items.map((item) => item.id)).size !== value.items.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate preset identifier",
      });
    if (
      !Object.hasOwn(narrationPresets, value.selected) &&
      !value.items.some((item) => item.id === value.selected)
    )
      context.addIssue({
        code: "custom",
        message: "Selected preset does not exist",
      });
    for (const item of value.items) {
      if (!narrationParametersSchema.safeParse(item.settings).success)
        context.addIssue({
          code: "custom",
          message: "Invalid narration settings",
        });
    }
  });
export const narrationPresetLibrarySchema = z
  .object({
    en: languagePresetsSchema,
    es: languagePresetsSchema,
    pt: languagePresetsSchema,
  })
  .strict();
export type NarrationPresetLibrary = z.infer<
  typeof narrationPresetLibrarySchema
>;
export function presetLibraryFromStyles(
  styles: NarrationStyles,
): NarrationPresetLibrary {
  return narrationPresetLibrarySchema.parse(
    Object.fromEntries(
      (["en", "es", "pt"] as const).map((locale) => {
        const style = styles[locale];
        return [
          locale,
          style.preset === "custom"
            ? {
                selected: "saved-narration",
                items: [
                  {
                    id: "saved-narration",
                    name: "Saved narration",
                    settings: resolveNarrationStyle(style),
                  },
                ],
              }
            : { selected: style.preset, items: [] },
        ];
      }),
    ),
  );
}
export function stylesFromPresetLibrary(
  library: NarrationPresetLibrary,
): NarrationStyles {
  return narrationStylesSchema.parse(
    Object.fromEntries(
      (["en", "es", "pt"] as const).map((locale) => {
        const { selected, items } = library[locale];
        if (Object.hasOwn(narrationPresets, selected))
          return [locale, { preset: selected }];
        const { min_p, top_p, ...controls } = narrationParametersSchema.parse(
          items.find((item) => item.id === selected)?.settings,
        );
        return [locale, { preset: "custom", ...controls }];
      }),
    ),
  );
}
