"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translations, type Locale, type Dictionary } from "./translations";

export type LanguageContextValue = {
  language: Locale;
  setLanguage: (lang: Locale) => void;
  dict: Dictionary;
  localeTag: "es-ES" | "en-US";
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectInitialLanguage(): Locale {
  try {
    const stored = localStorage.getItem("av_lang");
    if (stored === "es" || stored === "en") return stored;
  } catch {}
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return nav.toLowerCase().startsWith("en") ? "en" : "es";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Locale>("es");

  useEffect(() => {
    const detected = detectInitialLanguage();
    if (detected !== language) setLanguageState(detected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = (lang: Locale) => {
    try {
      localStorage.setItem("av_lang", lang);
    } catch {}
    setLanguageState(lang);
  };

  const value: LanguageContextValue = {
    language,
    setLanguage,
    dict: translations[language],
    localeTag: language === "en" ? "en-US" : "es-ES",
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
