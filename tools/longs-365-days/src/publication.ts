import type { Version } from "./config.js";
import type { IntroTitle } from "./video.js";

const copy = {
  es: {
    reading: "Hoy escuchamos", follow: "Síguenos para escuchar más de la palabra de Dios.",
    instagram: "Guarda este pasaje para volver a él y compártelo con alguien que lo necesite.",
    tiktok: "Una pausa para escuchar la palabra de Dios. Síguenos para tu dosis diaria.",
    tags: ["Biblia", "PalabraDeDios", "Jesus"], verse: "BibliaEn365Dias",
    themes: ["Fe", "AmorDeDios", "Esperanza", "Paz", "Perdon", "Salvacion"]
  },
  en: {
    reading: "Today we listen to", follow: "Follow us to hear more of the word of God.",
    instagram: "Save this passage to revisit it and share it with someone who needs it.",
    tiktok: "Take a moment to hear the word of God. Follow us for your daily dose.",
    tags: ["Bible", "WordOfGod", "Jesus"], verse: "BibleIn365Days",
    themes: ["Faith", "GodsLove", "Hope", "Peace", "Forgiveness", "Salvation"]
  },
  pt: {
    reading: "Hoje ouvimos", follow: "Siga-nos para ouvir mais da palavra de Deus.",
    instagram: "Salve esta passagem para voltar a ela e compartilhe com alguém que precise.",
    tiktok: "Uma pausa para ouvir a palavra de Deus. Siga-nos para sua dose diária.",
    tags: ["Biblia", "PalavraDeDeus", "Jesus"], verse: "BibliaEm365Dias",
    themes: ["Fe", "AmorDeDeus", "Esperanca", "Paz", "Perdao", "Salvacao"]
  }
};
const themePatterns = [
  /\b(fe|faith|crer|cre|cree|creyere|creem|believ\w*|confi\w*|trust\w*)\b/u,
  /\b(amor|amo|amou|ama|love\w*)\b/u,
  /\b(esperanza|esperanca|hope|vida eterna|eternal life)\b/u,
  /\b(paz|peace|descanso|rest)\b/u,
  /\b(perdon\w*|perdo\w*|forgiv\w*)\b/u,
  /\b(salv\w*|saved|salvation|redenc\w*|redemption)\b/u
];

/** Ready-to-paste localized copy. X deliberately includes every selected verse. */
export function publicationDescriptions(locale: Version["locale"], title: IntroTitle, verses: string[]): Record<string, string> {
  const language = copy[locale];
  const passage = verses.map(text => text.replace(/\(H\d+-\d+\)/g, "").replace(/\s+/gu, " ").trim()).join("\n");
  const clean = passage.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const themes = themePatterns.flatMap((pattern, index) => pattern.test(clean) ? [language.themes[index]] : []).slice(0, 3);
  const book = title.reference.replace(/\s+\d+:.*$/u, "").normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");
  const hashtags = (extra: string) => [...new Set(["VeoBible", ...language.tags, language.verse, book, ...themes, extra])].filter(Boolean).map(tag => `#${tag}`).join(" ");
  const heading = `${title.title}.\n${language.reading} ${title.reference} — ${title.version}.`;
  const finish = (body: string, extra: string) => `${body}\n\nveobible.com\n\n${hashtags(extra)}\n`;
  return {
    "youtube.txt": finish(`${heading}\n\n${language.follow}`, "BibleIn365Days"),
    "instagram.txt": finish(`${heading}\n\n${language.instagram}\n${language.follow}`, "Reels"),
    "tiktok.txt": finish(`${heading}\n\n${language.tiktok}`, locale === "en" ? "BibleTok" : "BibliaTikTok"),
    "x.txt": finish(`${heading}\n\n${passage}\n\n${language.follow}`, "")
  };
}
