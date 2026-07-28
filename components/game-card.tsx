"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import type { GameWithStats } from "@/lib/data/games";
import { useLanguage } from "@/lib/i18n/language-context";

export function GameCard({ game }: { game: GameWithStats }) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { dict, localeTag } = useLanguage();

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = "";
  };

  const goToDetail = () => router.push(`/games/${game.id}`);

  return (
    <div
      ref={tiltRef}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={goToDetail}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover}></div>
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>{dict.gameCard.bestScore}</span>
            <b>{game.best.toLocaleString(localeTag)}</b>
          </div>
          <button
            className={
              "btn " +
              (game.color === "magenta"
                ? "magenta"
                : game.color === "yellow"
                  ? "yellow"
                  : "")
            }
            onClick={(e) => {
              e.stopPropagation();
              goToDetail();
            }}
          >
            {dict.gameCard.play}
          </button>
        </div>
      </div>
    </div>
  );
}
