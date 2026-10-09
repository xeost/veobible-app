import {
  fillPublicationTemplate,
  publicationPlatforms,
  type PublicationTemplates,
} from "./publication-templates.js";

interface PublicationTitle {
  title: string;
  reference: string;
  version: string;
}
const longSeries = {
  es: "BibliaEn365Dias",
  en: "BibleIn365Days",
  pt: "BibliaEm365Dias",
};
const copy = {
  es: {
    tags: ["Biblia", "PalabraDeDios", "Jesus"],
    verse: "VersiculoDelDia",
    themes: ["Fe", "AmorDeDios", "Esperanza", "Paz", "Perdon", "Salvacion"],
  },
  en: {
    tags: ["Bible", "WordOfGod", "Jesus"],
    verse: "VerseOfTheDay",
    themes: ["Faith", "GodsLove", "Hope", "Peace", "Forgiveness", "Salvation"],
  },
  pt: {
    tags: ["Biblia", "PalavraDeDeus", "Jesus"],
    verse: "VersiculoDoDia",
    themes: ["Fe", "AmorDeDeus", "Esperanca", "Paz", "Perdao", "Salvacao"],
  },
};
const themePatterns = [
  /\b(fe|faith|crer|cre|cree|creyere|creem|believ\w*|confi\w*|trust\w*)\b/u,
  /\b(amor|amo|amou|ama|love\w*)\b/u,
  /\b(esperanza|esperanca|hope|vida eterna|eternal life)\b/u,
  /\b(paz|peace|descanso|rest)\b/u,
  /\b(perdon\w*|perdo\w*|forgiv\w*)\b/u,
  /\b(salv\w*|saved|salvation|redenc\w*|redemption)\b/u,
];

/** Ready-to-paste localized copy. X deliberately includes every selected verse. */
export function publicationDescriptions(
  locale: "en" | "es" | "pt",
  title: PublicationTitle,
  verses: string[],
  templates: PublicationTemplates,
  kind: "short" | "long",
): Record<string, string> {
  const language = copy[locale];
  const passage = verses
    .map((text) =>
      text
        .replace(/\(H\d+-\d+\)/g, "")
        .replace(/\s+/gu, " ")
        .trim(),
    )
    .join("\n");
  const clean = passage.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const themes = themePatterns
    .flatMap((pattern, index) =>
      pattern.test(clean) ? [language.themes[index]] : [],
    )
    .slice(0, 3);
  const book = title.reference
    .replace(/\s+\d+:.*$/u, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
  const hashtags = (extra: string) =>
    [
      ...new Set([
        "VeoBible",
        ...language.tags,
        kind === "short" ? language.verse : longSeries[locale],
        book,
        ...themes,
        extra,
      ]),
    ]
      .filter(Boolean)
      .map((tag) => `#${tag}`)
      .join(" ");
  const result: Record<string, string> = {};
  for (const platform of publicationPlatforms(kind)) {
    const template = templates[platform];
    if (!template?.trim()) continue;
    const extra =
      platform === "youtube" || platform === "facebook"
        ? kind === "short"
          ? "Shorts"
          : "BibleIn365Days"
        : platform === "instagram"
          ? "Reels"
          : platform === "tiktok"
            ? locale === "en"
              ? "BibleTok"
              : "BibliaTikTok"
            : "";
    result[`${platform}.txt`] =
      fillPublicationTemplate(template, {
        title: title.title,
        reference: title.reference,
        version: title.version,
        passage,
        hashtags: hashtags(extra),
      }).trimEnd() + "\n";
  }
  return result;
}
