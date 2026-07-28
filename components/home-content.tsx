"use client";

import Link from "next/link";
import type { GameWithStats } from "@/lib/data/games";
import { HomeReveal } from "@/components/home-reveal";
import { useLanguage } from "@/lib/i18n/language-context";

function FloatingSilhouettes() {
  return (
    <div className="home-silos" aria-hidden="true">
      <svg className="silo s1" viewBox="0 0 40 32">
        <g fill="#00f5ff">
          <rect x="6" y="4" width="4" height="4" />
          <rect x="30" y="4" width="4" height="4" />
          <rect x="2" y="8" width="36" height="4" />
          <rect x="2" y="12" width="4" height="4" />
          <rect x="14" y="12" width="4" height="4" />
          <rect x="22" y="12" width="4" height="4" />
          <rect x="34" y="12" width="4" height="4" />
          <rect x="2" y="16" width="36" height="4" />
          <rect x="6" y="20" width="4" height="4" />
          <rect x="30" y="20" width="4" height="4" />
        </g>
      </svg>
      <svg className="silo s2" viewBox="0 0 32 32">
        <g fill="#ff006e">
          <rect x="8" y="0" width="16" height="4" />
          <rect x="4" y="4" width="24" height="4" />
          <rect x="0" y="8" width="32" height="12" />
          <rect x="0" y="20" width="6" height="6" />
          <rect x="10" y="20" width="4" height="6" />
          <rect x="18" y="20" width="4" height="6" />
          <rect x="26" y="20" width="6" height="6" />
        </g>
      </svg>
      <svg className="silo s3" viewBox="0 0 32 32">
        <g fill="#f5ff00">
          <rect x="10" y="0" width="12" height="4" />
          <rect x="6" y="4" width="20" height="4" />
          <rect x="4" y="8" width="6" height="6" />
          <rect x="22" y="8" width="6" height="6" />
          <rect x="2" y="14" width="28" height="10" />
          <rect x="6" y="24" width="4" height="4" />
          <rect x="14" y="24" width="4" height="4" />
          <rect x="22" y="24" width="4" height="4" />
        </g>
      </svg>
      <svg className="silo s4" viewBox="0 0 24 24">
        <g fill="#00ff88">
          <rect x="10" y="0" width="4" height="24" />
          <rect x="0" y="10" width="24" height="4" />
          <rect
            x="6"
            y="6"
            width="12"
            height="12"
            fill="none"
            stroke="#00ff88"
            strokeWidth="2"
          />
        </g>
      </svg>
      <svg className="silo s5" viewBox="0 0 36 24">
        <g fill="#aa00ff">
          <rect x="14" y="2" width="8" height="4" />
          <rect x="10" y="6" width="16" height="4" />
          <rect x="4" y="10" width="28" height="4" />
          <rect x="0" y="14" width="36" height="4" />
          <rect x="6" y="18" width="4" height="2" />
          <rect x="16" y="18" width="4" height="2" />
          <rect x="26" y="18" width="4" height="2" />
        </g>
      </svg>
      <svg className="silo s6" viewBox="0 0 20 20">
        <g fill="#ffcf3a">
          <rect x="6" y="0" width="8" height="2" />
          <rect x="2" y="2" width="16" height="2" />
          <rect x="0" y="4" width="20" height="12" />
          <rect x="2" y="16" width="16" height="2" />
          <rect x="6" y="18" width="8" height="2" />
          <rect x="8" y="4" width="4" height="12" fill="#0a0a0f" />
        </g>
      </svg>
      <svg className="silo s7" viewBox="0 0 24 22">
        <g fill="#ff3060">
          <rect x="2" y="2" width="6" height="2" />
          <rect x="16" y="2" width="6" height="2" />
          <rect x="0" y="4" width="10" height="4" />
          <rect x="14" y="4" width="10" height="4" />
          <rect x="0" y="8" width="24" height="4" />
          <rect x="2" y="12" width="20" height="2" />
          <rect x="4" y="14" width="16" height="2" />
          <rect x="6" y="16" width="12" height="2" />
          <rect x="8" y="18" width="8" height="2" />
          <rect x="10" y="20" width="4" height="2" />
        </g>
      </svg>
      <svg className="silo s8" viewBox="0 0 24 24">
        <g fill="#00d4ff">
          <rect x="8" y="2" width="8" height="6" />
          <rect x="2" y="8" width="20" height="8" />
          <rect x="8" y="16" width="8" height="6" />
          <rect x="11" y="6" width="2" height="2" fill="#0a0a0f" />
          <rect x="11" y="16" width="2" height="2" fill="#0a0a0f" />
          <rect x="4" y="11" width="2" height="2" fill="#0a0a0f" />
          <rect x="18" y="11" width="2" height="2" fill="#0a0a0f" />
        </g>
      </svg>
    </div>
  );
}

function MiniCard({ game }: { game: GameWithStats }) {
  return (
    <Link href={`/games/${game.id}`} className="mini-card">
      <div className="mini-cover">
        <div className={"cover-bg " + game.cover}></div>
      </div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </Link>
  );
}

function FeatureIcon({ kind }: { kind: string }) {
  const C = "currentColor";
  if (kind === "GAMEPAD")
    return (
      <svg className="ft-icon" viewBox="0 0 16 16">
        <g fill={C}>
          <rect x="2" y="6" width="12" height="6" />
          <rect x="0" y="8" width="2" height="4" />
          <rect x="14" y="8" width="2" height="4" />
          <rect x="3" y="8" width="2" height="2" />
          <rect x="2" y="9" width="4" height="0.5" />
          <rect x="11" y="7" width="1.5" height="1.5" />
          <rect x="11" y="10" width="1.5" height="1.5" />
        </g>
      </svg>
    );
  if (kind === "FREE")
    return (
      <svg className="ft-icon" viewBox="0 0 16 16">
        <g fill={C}>
          <rect
            x="3"
            y="3"
            width="10"
            height="10"
            fill="none"
            stroke={C}
            strokeWidth="1.5"
          />
          <rect x="5" y="6" width="1.5" height="4" />
          <rect x="5" y="6" width="4" height="1.5" />
          <rect x="5" y="8" width="3" height="1" />
          <rect x="10" y="6" width="1.5" height="4" />
        </g>
      </svg>
    );
  if (kind === "TROPHY")
    return (
      <svg className="ft-icon" viewBox="0 0 16 16">
        <g fill={C}>
          <rect x="3" y="2" width="10" height="2" />
          <rect x="3" y="2" width="2" height="6" />
          <rect x="11" y="2" width="2" height="6" />
          <rect x="5" y="8" width="6" height="2" />
          <rect x="7" y="10" width="2" height="3" />
          <rect x="5" y="13" width="6" height="1.5" />
          <rect x="1" y="3" width="2" height="3" />
          <rect x="13" y="3" width="2" height="3" />
        </g>
      </svg>
    );
  if (kind === "ROCKET")
    return (
      <svg className="ft-icon" viewBox="0 0 16 16">
        <g fill={C}>
          <rect x="7" y="1" width="2" height="2" />
          <rect x="6" y="3" width="4" height="2" />
          <rect x="5" y="5" width="6" height="6" />
          <rect x="4" y="11" width="2" height="2" />
          <rect x="10" y="11" width="2" height="2" />
          <rect x="7" y="6" width="2" height="2" fill="#0a0a0f" />
          <rect x="6" y="13" width="1" height="2" />
          <rect x="9" y="13" width="1" height="2" />
        </g>
      </svg>
    );
  return null;
}

const FEATURE_STYLE = [
  { icon: "GAMEPAD", color: "cyan" },
  { icon: "FREE", color: "yellow" },
  { icon: "TROPHY", color: "magenta" },
  { icon: "ROCKET", color: "green" },
];

export function HomeContent({
  games,
  recentScores,
  topPlayers,
}: {
  games: GameWithStats[];
  recentScores: { player: string; game: string; score: number; at: string }[];
  topPlayers: { rank: number; player: string; score: number }[];
}) {
  const { dict, localeTag } = useLanguage();
  const colorByTitle = new Map(games.map((g) => [g.title, g.color]));

  return (
    <div className="home fade-in">
      <HomeReveal />
      {/* HERO */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ {dict.home.heroEyebrow}
            <span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">{dict.home.heroTitleLine1}</span>
            <span className="line-2">{dict.home.heroTitleLine2}</span>
            <span className="line-3">{dict.home.heroTitleLine3}</span>
          </h1>
          <p className="home-sub">
            {dict.home.heroSubLine1}
            <br />
            {dict.home.heroSubLine2}
          </p>
          <div className="home-ctas">
            <Link className="btn xl pulse" href="/games">
              {dict.home.ctaExplore}
            </Link>
            <Link className="btn xl magenta" href="/login">
              {dict.home.ctaCreateAccount}
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>{dict.home.scrollHint}</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">// 01</div>
          <h2 className="section-title">{dict.home.sectionWhyTitle}</h2>
          <div className="section-rule"></div>
        </div>
        <div className="feature-grid">
          {dict.home.features.map((f, i) => (
            <div
              key={i}
              className={"feature-card " + FEATURE_STYLE[i].color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <FeatureIcon kind={FEATURE_STYLE[i].icon} />
              <div className="ft-title pixel">{f.title}</div>
              <div className="ft-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GAMES PREVIEW */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">// 02</div>
          <h2 className="section-title">{dict.home.sectionGamesTitle}</h2>
          <div className="section-rule"></div>
        </div>
        <div className="mini-rail">
          {games.slice(0, 6).map((g) => (
            <MiniCard key={g.id} game={g} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link className="btn lg" href="/games">
            {dict.home.viewAllGames}
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="home-stats reveal">
        <div className="stats-inner">
          {dict.home.stats.map((st, i) => (
            <div
              key={i}
              className="stat-block"
              style={{ transitionDelay: i * 90 + "ms" }}
            >
              <div className="stat-n neon-yellow">{st.n}</div>
              <div className="stat-u pixel">{st.unit}</div>
              <div className="stat-s">{st.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* RECENT ACTIVITY / LEADERBOARD */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">// 03</div>
          <h2 className="section-title">{dict.home.sectionActivityTitle}</h2>
          <div className="section-rule"></div>
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">
                {dict.home.recentScoresTitle}
              </div>
            </div>
            <div className="ticker">
              {recentScores.length === 0 && (
                <div style={{ color: "var(--ink-faint)", padding: "8px 0" }}>
                  {dict.home.recentScoresEmpty}
                </div>
              )}
              {recentScores.map((r, i) => (
                <div
                  key={i}
                  className="tick-row"
                  style={{ animationDelay: i * 60 + "ms" }}
                >
                  <span
                    className={
                      "tk-p neon-" + (colorByTitle.get(r.game) ?? "cyan")
                    }
                  >
                    {r.player}
                  </span>
                  <span className="tk-mid">▸ {r.game}</span>
                  <span className="tk-s">
                    +{r.score.toLocaleString(localeTag)}
                  </span>
                  <span className="tk-t">{r.at}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">
                {dict.home.topPlayersTitle}
              </div>
              <Link className="lb-link" href="/hall-of-fame">
                {dict.home.viewHallOfFame}
              </Link>
            </div>
            <div className="top-list">
              {topPlayers.length === 0 && (
                <div style={{ color: "var(--ink-faint)", padding: "8px 0" }}>
                  {dict.home.topPlayersEmpty}
                </div>
              )}
              {topPlayers.map((r, i) => (
                <div
                  key={i}
                  className={
                    "top-row" +
                    (i === 0
                      ? " top1"
                      : i === 1
                        ? " top2"
                        : i === 2
                          ? " top3"
                          : "")
                  }
                >
                  <span className="tp-rk">
                    #{String(r.rank).padStart(2, "0")}
                  </span>
                  <span className="tp-bar">
                    <span
                      className="tp-fill"
                      style={{ width: 100 - i * 16 + "%" }}
                    ></span>
                  </span>
                  <span className="tp-p">{r.player}</span>
                  <span className="tp-s">
                    {r.score.toLocaleString(localeTag)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="home-section reveal">
        <div className="section-head">
          <div className="kicker pixel neon-green">// 04</div>
          <h2 className="section-title">{dict.home.sectionPricingTitle}</h2>
          <div className="section-rule"></div>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">{dict.home.pricing.label}</div>
            <div className="pc-name pixel">{dict.home.pricing.name}</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">
                {dict.home.pricing.amountUnit}
              </span>
            </div>
            <div className="pc-tag">{dict.home.pricing.tag}</div>
            <ul className="pc-list">
              {dict.home.pricing.list.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <Link
              className="btn xl pulse"
              style={{ width: "100%" }}
              href="/login"
            >
              {dict.home.pricing.cta}
            </Link>
            <div className="pc-foot">{dict.home.pricing.foot}</div>
            <div className="pc-stamp pixel">
              {dict.home.pricing.stampLine1}
              <br />
              {dict.home.pricing.stampLine2}
            </div>
          </div>

          <div className="pricing-faq">
            {dict.home.faq.map((item, i) => (
              <div className="faq-item" key={i}>
                <div className="faq-q pixel">{item.q}</div>
                <div className="faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="home-final reveal">
        <h2 className="final-title pixel">{dict.home.finalTitle}</h2>
        <Link className="btn xl pulse final-cta" href="/games">
          {dict.home.finalCta}
        </Link>
        <div className="final-tag">{dict.home.finalTag}</div>
      </section>
    </div>
  );
}
