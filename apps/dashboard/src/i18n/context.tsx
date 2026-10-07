"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { spanish } from "./es";
import { portuguese } from "./pt";
export type Language = "es" | "en" | "pt";
const Context = createContext({
  language: "en" as Language,
  setLanguage: (_: Language) => {},
  t: (text: string): string => text,
});
export function I18nProvider({
  initialLanguage = "en",
  children,
}: {
  initialLanguage?: Language;
  children: ReactNode;
}) {
  const [language, updateLanguage] = useState(initialLanguage);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("veo-language");
      if (saved === "es" || saved === "en" || saved === "pt")
        updateLanguage(saved);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const setLanguage = (value: Language) => {
    updateLanguage(value);
    document.documentElement.lang = value;
    document.cookie = `veo_language=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem("veo-language", value);
    } catch {}
  };
  const t = (text: string) => {
    if (language === "es") return spanish[text] ?? text;
    if (language === "pt") return portuguese[text] ?? text;
    return text;
  };
  return (
    <Context.Provider value={{ language, setLanguage, t }}>
      {children}
    </Context.Provider>
  );
}
export const useI18n = () => useContext(Context);
