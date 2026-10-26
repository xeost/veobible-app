"use client";
import { createContext } from "react";

export type Language = "es" | "en" | "pt";

// Keep the context independent of dictionaries so translation edits do not
// replace the context still used by the mounted provider during hot updates.
export const LanguageContext = createContext({
  language: "en" as Language,
  setLanguage: (_: Language) => {},
  t: (text: string): string => text,
});
