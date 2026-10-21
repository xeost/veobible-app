"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  browserLanguage,
  persistBrowserLanguage,
} from "../lib/language-preference";
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
    <Context.Provider value={{ language, setLanguage, t }}>
      {children}
    </Context.Provider>
  );
}
export const useI18n = () => useContext(Context);
