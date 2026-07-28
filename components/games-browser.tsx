"use client";

import { useMemo, useState } from "react";
import { CATS } from "@/app/data/games";
import { GameCard } from "@/components/game-card";
import type { GameWithStats } from "@/lib/data/games";
import { useLanguage } from "@/lib/i18n/language-context";
import { localizedGameText } from "@/lib/i18n/localize-game";

export function GamesBrowser({ games }: { games: GameWithStats[] }) {
  const { dict, language } = useLanguage();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("TODOS");

  const filtered = useMemo(() => {
    return games.filter(
      (g) =>
        (cat === "TODOS" || g.cat === cat) &&
        localizedGameText(g, language)
          .title.toLowerCase()
          .includes(q.toLowerCase()),
    );
  }, [games, q, cat, language]);

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dict.gamesCatalog.searchPlaceholder}
          />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button
              key={c}
              className={"chip" + (cat === c ? " active" : "")}
              onClick={() => setCat(c)}
            >
              {c === "TODOS" ? dict.common.allCategory : c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 80,
              color: "var(--ink-faint)",
            }}
          >
            <div
              className="pixel"
              style={{
                fontSize: 14,
                color: "var(--magenta)",
                marginBottom: 12,
              }}
            >
              {dict.gamesCatalog.noResultsTitle}
            </div>
            <div>{dict.gamesCatalog.noResultsBody}</div>
          </div>
        )}
      </div>
    </>
  );
}
