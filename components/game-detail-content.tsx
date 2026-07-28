"use client";

import Link from "next/link";
import type { GameWithStats } from "@/lib/data/games";
import type { ScoreRow } from "@/app/data/games";
import { useLanguage } from "@/lib/i18n/language-context";

export function GameDetailContent({
  game,
  scores,
}: {
  game: GameWithStats;
  scores: ScoreRow[];
}) {
  const { dict, localeTag } = useLanguage();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>{dict.gameDetail.tagSinglePlayer}</span>
            <span>{dict.gameDetail.tagKeyboardTouch}</span>
            <span>{dict.gameDetail.tagRetro}</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">{dict.gameDetail.statPlays}</div>
              <div className="v">{game.plays.toLocaleString(localeTag)}</div>
            </div>
            <div>
              <div className="l">{dict.gameDetail.statBest}</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                {game.best.toLocaleString(localeTag)}
              </div>
            </div>
            <div>
              <div className="l">{dict.gameDetail.statDifficulty}</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/games/${game.id}/play`}>
              {dict.gameDetail.playNow}
            </Link>
            <Link className="btn ghost lg" href="/games">
              {dict.gameDetail.backToVault}
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>{dict.gameDetail.leaderboardTitle}</h3>
          {scores.map((r, i) => (
            <div
              key={r.rank}
              className={
                "lb-row" +
                (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
            >
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">
                {r.name}
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-faint)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {r.date}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString(localeTag)}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
