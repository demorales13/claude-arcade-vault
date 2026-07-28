"use client";

import { useEffect } from "react";
import { AboutContactForm } from "@/components/about-contact-form";
import { useLanguage } from "@/lib/i18n/language-context";

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const HIGHLIGHT_STYLE: {
  icon: "HEART" | "BROWSER" | "PLANT";
  color: string;
}[] = [
  { icon: "HEART", color: "magenta" },
  { icon: "BROWSER", color: "cyan" },
  { icon: "PLANT", color: "green" },
];

export default function AboutPage() {
  useReveal();
  const { dict } = useLanguage();

  return (
    <div className="about fade-in">
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">{dict.about.kicker}</div>
        <h1 className="about-title">{dict.about.title}</h1>
        <p className="about-mission">{dict.about.mission}</p>

        <div className="highlight-row">
          {dict.about.highlights.map((text, i) => (
            <div
              key={HIGHLIGHT_STYLE[i].icon}
              className={"highlight " + HIGHLIGHT_STYLE[i].color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <HighlightIcon kind={HIGHLIGHT_STYLE[i].icon} />
              <div className="hl-text pixel">{text}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">
              {dict.about.contactKicker}
            </div>
            <h2 className="contact-title">{dict.about.contactTitle}</h2>
            <p className="contact-sub">{dict.about.contactSub}</p>
            <div className="contact-tips">
              <div className="tip">
                <span className="tip-led"></span>
                {dict.about.tips[0]}
              </div>
              <div className="tip">
                <span className="tip-led y"></span>
                {dict.about.tips[1]}
              </div>
              <div className="tip">
                <span className="tip-led m"></span>
                {dict.about.tips[2]}
              </div>
            </div>
          </div>

          <AboutContactForm />
        </div>
      </section>
    </div>
  );
}

function HighlightIcon({ kind }: { kind: "HEART" | "BROWSER" | "PLANT" }) {
  const C = "currentColor";
  if (kind === "HEART")
    return (
      <svg className="hl-icon" viewBox="0 0 16 16">
        <g fill={C}>
          <rect x="2" y="3" width="4" height="2" />
          <rect x="10" y="3" width="4" height="2" />
          <rect x="1" y="4" width="2" height="4" />
          <rect x="13" y="4" width="2" height="4" />
          <rect x="2" y="8" width="2" height="2" />
          <rect x="12" y="8" width="2" height="2" />
          <rect x="3" y="9" width="10" height="2" />
          <rect x="4" y="11" width="8" height="2" />
          <rect x="5" y="12" width="6" height="2" />
          <rect x="6" y="13" width="4" height="1" />
          <rect x="7" y="14" width="2" height="1" />
        </g>
      </svg>
    );
  if (kind === "BROWSER")
    return (
      <svg className="hl-icon" viewBox="0 0 16 16">
        <g fill={C}>
          <rect
            x="1"
            y="2"
            width="14"
            height="12"
            fill="none"
            stroke={C}
            strokeWidth="1.4"
          />
          <rect x="1" y="2" width="14" height="3" />
          <rect x="3" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="5" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="7" y="3" width="1" height="1" fill="#0a0a0f" />
          <rect x="3" y="7" width="4" height="1" />
          <rect x="3" y="9" width="6" height="1" />
          <rect x="3" y="11" width="3" height="1" />
        </g>
      </svg>
    );
  return (
    <svg className="hl-icon" viewBox="0 0 16 16">
      <g fill={C}>
        <rect x="7" y="2" width="2" height="10" />
        <rect x="4" y="4" width="3" height="2" />
        <rect x="9" y="6" width="3" height="2" />
        <rect x="3" y="3" width="2" height="2" />
        <rect x="11" y="5" width="2" height="2" />
        <rect x="3" y="12" width="10" height="2" />
        <rect x="4" y="14" width="8" height="1" />
      </g>
    </svg>
  );
}
