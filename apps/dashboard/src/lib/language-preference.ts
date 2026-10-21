import type { Language } from "../i18n/context";

export function resolveLanguagePreference(
  cookie: string,
  stored: unknown,
  fallback: Language = "en",
): Language {
  // Match the server's preference before considering older browser storage.
  const selected = cookie.match(
    /(?:^|;\s*)veo_language=(es|en|pt)(?:;|$)/,
  )?.[1];
  if (selected) return selected as Language;
  if (stored === "es" || stored === "en" || stored === "pt") return stored;
  return fallback;
}

export function browserLanguage(fallback: Language = "en"): Language {
  if (typeof document === "undefined") return fallback;
  let stored: unknown;
  try {
    stored = localStorage.getItem("veo-language");
  } catch {}
  const displayed = document.documentElement.lang;
  return resolveLanguagePreference(
    document.cookie,
    stored,
    displayed === "es" || displayed === "pt" || displayed === "en"
      ? displayed
      : fallback,
  );
}

export function persistBrowserLanguage(language: Language) {
  document.documentElement.lang = language;
  try {
    document.cookie = `veo_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {}
  try {
    localStorage.setItem("veo-language", language);
  } catch {}
}
