"use client";

import { useLanguage } from "@/lib/i18n/language-context";

export function GamesCatalogHero() {
  const { dict } = useLanguage();

  return (
    <section className="av-hero">
      <h1 className="flicker">ARCADE VAULT</h1>
      <div className="sub">
        {dict.gamesCatalog.heroSubtitle} <span className="blink">_</span>
      </div>
    </section>
  );
}
