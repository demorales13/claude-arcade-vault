"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";

type AvUser = { name: string } | null;

function readUser(): AvUser {
  try {
    return JSON.parse(localStorage.getItem("av_user") || "null");
  } catch {
    return null;
  }
}

function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="lang-toggle" role="group" aria-label="ES / EN">
      <button
        type="button"
        className={language === "es" ? "active" : ""}
        onClick={() => setLanguage("es")}
      >
        ES
      </button>
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AvUser>(null);
  const { dict } = useLanguage();

  useEffect(() => {
    setUser(readUser());
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isHome = pathname === "/";
  const isBiblioteca = pathname.startsWith("/games");
  const isSalon = pathname === "/hall-of-fame";
  const isAbout = pathname === "/about";
  const isAuth = pathname === "/login";

  const handleSignOut = () => {
    try {
      localStorage.removeItem("av_user");
    } catch {}
    setUser(null);
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isHome ? "active" : ""}>
            {dict.nav.home}
          </Link>
          <Link href="/games" className={isBiblioteca ? "active" : ""}>
            {dict.nav.library}
          </Link>
          <Link href="/hall-of-fame" className={isSalon ? "active" : ""}>
            {dict.nav.hallOfFame}
          </Link>
          <Link href="/about" className={isAbout ? "active" : ""}>
            {dict.nav.about}
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>{dict.nav.credits}</span>
        </div>
        <LanguageToggle />
        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/login" className="btn auth-btn">
            {dict.nav.signIn}
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label={dict.nav.menu}
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          {dict.nav.menu.toUpperCase()}
        </div>
        <LanguageToggle />
        <Link
          href="/"
          className={isHome ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          {dict.nav.home}
        </Link>
        <Link
          href="/games"
          className={isBiblioteca ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          {dict.nav.library}
        </Link>
        <Link
          href="/hall-of-fame"
          className={isSalon ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          {dict.nav.hallOfFame}
        </Link>
        <Link
          href="/about"
          className={isAbout ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          {dict.nav.about}
        </Link>
        {user ? (
          <a onClick={handleSignOut}>{dict.nav.signOut}</a>
        ) : (
          <Link
            href="/login"
            className={isAuth ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            {dict.nav.signIn}
          </Link>
        )}
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          {dict.nav.credits}
        </div>
      </aside>
    </>
  );
}
