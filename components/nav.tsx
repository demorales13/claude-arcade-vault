"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AvUser = { name: string } | null;

function readUser(): AvUser {
  try {
    return JSON.parse(localStorage.getItem("av_user") || "null");
  } catch {
    return null;
  }
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AvUser>(null);

  useEffect(() => {
    setUser(readUser());
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isBiblioteca = pathname === "/" || pathname.startsWith("/games");
  const isSalon = pathname === "/hall-of-fame";
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
          <Link href="/" className={isBiblioteca ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={isSalon ? "active" : ""}>
            Salón de la Fama
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/login" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isBiblioteca ? "active" : ""} onClick={() => setOpen(false)}>
          Biblioteca
        </Link>
        <Link
          href="/hall-of-fame"
          className={isSalon ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Salón de la Fama
        </Link>
        {user ? (
          <a onClick={handleSignOut}>Cerrar Sesión</a>
        ) : (
          <Link href="/login" className={isAuth ? "active" : ""} onClick={() => setOpen(false)}>
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
