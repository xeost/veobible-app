import { userMessage } from "../lib/presentation";
import type { Language } from "../i18n/context";

function currentLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem("veo-language");
    if (saved === "es" || saved === "en" || saved === "pt") return saved;
  } catch {}
  return "en";
}

export async function api<T = any>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const language = currentLanguage();
  const response = await fetch(`/api/${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-language": language,
      ...init.headers,
    },
  });
  const data = (await response.json()) as T & { error?: string };
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error(
      language === "es"
        ? "Inicia sesión"
        : language === "pt"
          ? "Faça login"
          : "Sign in",
    );
  }
  if (!response.ok)
    throw new Error(userMessage(data.error, response.status, language));
  return data;
}

export const date = (value: string | null, language: Language = "en") =>
  value
    ? new Date(value).toLocaleString(
        language === "en" ? "en-US" : language === "pt" ? "pt-BR" : "es-AR",
      )
    : "—";
