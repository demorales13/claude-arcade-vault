"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { createClient } from "@/lib/supabase/client";

type AvUser = { name: string; email?: string; avatar?: string } | null;

function readUser(): AvUser {
  try {
    return JSON.parse(localStorage.getItem("av_user") || "null");
  } catch {
    return null;
  }
}

function UserAvatar({ user }: { user: NonNullable<AvUser> }) {
  const [broken, setBroken] = useState(false);
  if (user.avatar && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="user-avatar"
        src={user.avatar}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="user-avatar user-avatar-fallback" aria-hidden="true">
      {user.name.slice(0, 1)}
    </span>
  );
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<AvUser>(null);
  const { dict } = useLanguage();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(readUser());
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        try {
          localStorage.removeItem("av_user");
        } catch {}
        setUser(null);
        return;
      }

      if (
        (event === "SIGNED_IN" ||
          event === "INITIAL_SESSION" ||
          event === "USER_UPDATED") &&
        session?.user
      ) {
        const displayName = session.user.user_metadata?.display_name;
        if (typeof displayName === "string" && displayName) {
          const next: NonNullable<AvUser> = { name: displayName };
          if (session.user.email) next.email = session.user.email;
          const avatar =
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture;
          if (typeof avatar === "string" && avatar) next.avatar = avatar;
          try {
            localStorage.setItem("av_user", JSON.stringify(next));
          } catch {}
          setUser(next);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isHome = pathname === "/";
  const isBiblioteca = pathname.startsWith("/games");
  const isSalon = pathname === "/hall-of-fame";
  const isAbout = pathname === "/about";
  const isAuth = pathname === "/login";

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
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
          <div className="user-menu" ref={userMenuRef}>
            <button
              className="btn ghost auth-btn"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
            >
              <UserAvatar user={user} />
              {user.name} ▾
            </button>
            <div className={"user-menu-panel" + (userMenuOpen ? " open" : "")}>
              <div className="user-menu-identity">
                <UserAvatar user={user} />
                <div>
                  <div className="user-menu-name neon-cyan">{user.name}</div>
                  {user.email && (
                    <div className="user-menu-email mono">{user.email}</div>
                  )}
                </div>
              </div>
              <button
                className="btn ghost"
                style={{ width: "100%", marginTop: 12 }}
                onClick={handleSignOut}
              >
                {dict.nav.signOut}
              </button>
            </div>
          </div>
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
          <>
            <div className="mobile-user-info user-menu-identity">
              <UserAvatar user={user} />
              <div>
                <div className="user-menu-name neon-cyan">{user.name}</div>
                {user.email && (
                  <div className="user-menu-email mono">{user.email}</div>
                )}
              </div>
            </div>
            <a onClick={handleSignOut}>{dict.nav.signOut}</a>
          </>
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
