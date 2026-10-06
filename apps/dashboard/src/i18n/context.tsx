"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { english } from "./en";
export type Language = "es" | "en";
const Context = createContext({
  language: "es" as Language,
  setLanguage: (_: Language) => {},
  t: (text: string): string => text,
});
export function I18nProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: ReactNode;
}) {
  const [language, updateLanguage] = useState(initialLanguage);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("veo-language");
      if (saved === "es" || saved === "en") updateLanguage(saved);
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
  const t = (text: string) =>
    language === "en" ? (english[text] ?? text) : text;
  return (
    <Context.Provider value={{ language, setLanguage, t }}>
      {children}
    </Context.Provider>
  );
}
export const useI18n = () => useContext(Context);
