import { publicationFilenames } from "./output-files.js";
import type { RenderRequest } from "./protocol.js";
import {
  fillPublicationTemplate,
  publicationPlatforms,
  type PublicationTemplates,
} from "./publication-templates.js";

interface PublicationTitle {
  title: string;
  episode?: number;
  reference: string;
  version: string;
}
/** Use the project's original starting point, even when it spans books or chapters. */
export function publicationPassageUrl(
  input: Pick<RenderRequest, "version" | "passage">,
) {
  const { version, passage } = input;
  const chapter = `https://veobible.com/${version.locale}/${version.id}/${passage.book}/${passage.start.chapter}`;
  return passage.start.verse === 1
    ? chapter
    : `${chapter}#${passage.start.verse}`;
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
  passageUrl = "",
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
    .replace(/\s+(?:(?:chapters?|capítulos?)\s+)?\d+.*$/iu, "")
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
    // Split template headings before substitution so Bible text cannot create sections.
    const headings = [
      ...template.matchAll(/^ {0,3}#{1,6}[ \t]+[^\r\n]+(?:\r?\n|$)/gm),
    ];
    const sections = headings.length
      ? headings.map((heading, index) => {
          const start = heading.index! + heading[0].length;
          const end = headings[index + 1]?.index ?? template.length;
          const prefix =
            index === 0 ? template.slice(0, heading.index).trim() : "";
          return [prefix, template.slice(start, end).trim()]
            .filter(Boolean)
            .join("\n\n");
        })
      : [template];
    for (const [index, section] of sections.entries()) {
      const filename = headings.length
        ? publicationFilenames[platform].replace("-", `.${index + 1}-`)
        : publicationFilenames[platform];
      result[filename] = fillPublicationTemplate(section, {
        title: title.title,
        episode:
          kind === "long" && title.episode !== undefined
            ? String(title.episode)
            : "",
        reference: title.reference,
        version: title.version,
        passage,
        passage_url: passageUrl,
        hashtags: hashtags(extra),
      }).trimEnd() + "\n";
    }
  }
  return result;
}
