import type { Language } from "../i18n/context";
import { spanish } from "../i18n/es";
import { portuguese } from "../i18n/pt";

export function requestLanguage(req: Request): Language {
  const header = req.headers.get("x-language");
  if (header === "es" || header === "en" || header === "pt") return header;
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)veo_language=(es|en|pt)(?:;|$)/);
  if (match) return match[1] as Language;
  const accept = req.headers.get("accept-language") ?? "";
  if (/^pt/i.test(accept)) return "pt";
  if (/^es/i.test(accept)) return "es";
  return "en";
}

export function translateServer(text: string, lang: Language = "en"): string {
  if (lang === "es") return spanish[text] ?? text;
  if (lang === "pt") return portuguese[text] ?? text;
  return text;
}
