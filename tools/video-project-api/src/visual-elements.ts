import { z } from "zod";

export const subscribeElementSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  template: z.literal("youtube-subscribe"),
  startSeconds: z.number().finite().min(0).max(86400).default(0),
  durationSeconds: z.number().finite().min(1).max(60).default(5),
  label: z.string().trim().min(1).max(40),
  subscribedLabel: z.string().trim().min(1).max(40),
  hidden: z.boolean().default(false),
  references: z.array(z.string().min(1)).max(1000).optional(),
});
export const socialButtonElementSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  template: z.literal("social-button"),
  verticalPosition: z
    .enum([
      "top",
      "upper-third",
      "center",
      "lower-third",
      "lower-intermediate",
      "bottom",
    ])
    .default("lower-intermediate"),
  moment: z.enum(["start", "early", "middle", "late", "end"]).default("early"),
  hidden: z.boolean().default(false),
  references: z.array(z.string().min(1)).max(1000).optional(),
});
export const visualElementSchema = z.discriminatedUnion("template", [
  subscribeElementSchema,
  socialButtonElementSchema,
]);
export type SocialButtonElement = z.infer<typeof socialButtonElementSchema>;
export type VisualElement = z.infer<typeof visualElementSchema>;
export type SocialVariant = "subscribe" | "follow";
export type VideoLocale = "en" | "es" | "pt";
export const verticalPositions = [
  "top",
  "upper-third",
  "center",
  "lower-third",
  "lower-intermediate",
  "bottom",
] as const;
export const elementMoments = [
  "start",
  "early",
  "middle",
  "late",
  "end",
] as const;
export const verticalPositionFraction = {
  top: 0.12,
  "upper-third": 1 / 3,
  center: 0.5,
  "lower-third": 2 / 3,
  "lower-intermediate": (2 / 3 + 0.88) / 2,
  bottom: 0.88,
};
const momentFraction = {
  start: 0,
  early: 1 / 3,
  middle: 0.5,
  late: 2 / 3,
  end: 1,
};

export function socialButtonText(locale: VideoLocale, variant: SocialVariant) {
  const labels = {
    en: {
      subscribe: ["Subscribe", "Subscribed"],
      follow: ["Follow", "Following"],
    },
    es: {
      subscribe: ["Suscribirse", "Suscrito"],
      follow: ["Seguir", "Siguiendo"],
    },
    pt: {
      subscribe: ["Inscrever-se", "Inscrito"],
      follow: ["Seguir", "Seguindo"],
    },
  }[locale][variant];
  return { label: labels[0], subscribedLabel: labels[1] };
}

export function elementTiming(element: VisualElement, sectionDuration: number) {
  const duration = Math.min(
    element.template === "social-button" ? 5 : element.durationSeconds,
    Math.max(0, sectionDuration),
  );
  const start =
    element.template === "social-button"
      ? Math.max(0, sectionDuration - duration) * momentFraction[element.moment]
      : element.startSeconds;
  return {
    start,
    duration: Math.max(0, Math.min(duration, sectionDuration - start)),
  };
}

export function socialRenderVariants(
  elements: VisualElements = {},
): SocialVariant[] {
  return Object.values(elements).some((section) =>
    sectionVisualElements(section).some(
      (element) => element.template === "social-button" && !element.hidden,
    ),
  )
    ? ["subscribe", "follow"]
    : ["subscribe"];
}

/** Older projects stored a single element per section. Normalize them when loaded. */
export function sectionVisualElements(
  value?: VisualElement | VisualElement[],
): VisualElement[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export const visualElementsSchema = z.record(
  z.string().regex(/^(?:intro|outro|chapter-\d+|reading-\d+)$/),
  z
    .union([visualElementSchema, z.array(visualElementSchema)])
    .transform((value) =>
      sectionVisualElements(value).map((element, index) => ({
        ...element,
        id: element.id ?? `legacy-${index}`,
      })),
    ),
);
export type SubscribeElement = z.infer<typeof subscribeElementSchema>;
export type VisualElements = Record<string, VisualElement | VisualElement[]>;

type Timeline = {
  introLength: number;
  readingLength: number;
  outroLength: number;
  transitionDuration: number;
  readingSilence: number;
  verseCues: { reference: string; start: number; end: number }[];
  chapterIntroductions?: { part: string; start: number; duration: number }[];
};

/** Section-relative placement shared by previews and final compositions. */
export function visualElementRanges(
  props: Timeline,
  elements: VisualElements = {},
) {
  const readingStart = props.introLength - props.transitionDuration;
  const outroStart =
    readingStart + props.readingLength - props.transitionDuration;
  return Object.entries(elements).flatMap(([id, section]) =>
    sectionVisualElements(section).flatMap((element, index) => {
      if (element.hidden) return [];
      let start = 0;
      let end = props.introLength;
      if (id === "outro") {
        start = outroStart;
        end = start + props.outroLength;
      } else if (id.startsWith("chapter-")) {
        const chapter = props.chapterIntroductions?.find(
          (item) => item.part === id,
        );
        if (!chapter) return [];
        start = readingStart + props.readingSilence + chapter.start;
        end = start + chapter.duration;
      } else if (id.startsWith("reading-")) {
        const cues = props.verseCues.filter((cue) =>
          element.references?.includes(cue.reference),
        );
        if (!cues.length) return [];
        start =
          readingStart +
          props.readingSilence +
          Math.min(...cues.map((cue) => cue.start));
        end =
          readingStart +
          props.readingSilence +
          Math.max(...cues.map((cue) => cue.end));
      }
      const timing = elementTiming(element, end - start);
      start += timing.start;
      const duration = timing.duration;
      return duration > 0
        ? [
            {
              id,
              key: `${id}:${element.id ?? index}`,
              element,
              start,
              duration,
            },
          ]
        : [];
    }),
  );
}
