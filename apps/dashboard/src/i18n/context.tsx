"use client";
import { useContext, useEffect, useState, type ReactNode } from "react";
import {
  browserLanguage,
  persistBrowserLanguage,
} from "../lib/language-preference";
import { spanish } from "./es";
import { portuguese } from "./pt";
import { LanguageContext, type Language } from "./language-context";
export type { Language } from "./language-context";
export function I18nProvider({
  initialLanguage = "en",
  children,
}: {
  initialLanguage?: Language;
  children: ReactNode;
}) {
  const [language, updateLanguage] = useState(initialLanguage);
  useEffect(() => {
    const restored = browserLanguage(initialLanguage);
    updateLanguage(restored);
    persistBrowserLanguage(restored);
  }, [initialLanguage]);
  const setLanguage = (value: Language) => {
    persistBrowserLanguage(value);
    updateLanguage(value);
  };
  const t = (text: string) => {
    if (language === "es") return spanish[text] ?? text;
    if (language === "pt") return portuguese[text] ?? text;
    return text;
  };
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
export const useI18n = () => useContext(LanguageContext);
