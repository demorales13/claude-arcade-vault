"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";

function saveUser(name: string) {
  try {
    localStorage.setItem("av_user", JSON.stringify({ name }));
  } catch {}
}

export function AuthForm() {
  const router = useRouter();
  const { dict } = useLanguage();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saveUser((user || "PLAYER1").toUpperCase().slice(0, 10));
    router.push("/");
  };

  const playAsGuest = () => {
    saveUser("INVITADO");
    router.push("/");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            {dict.auth.subtitle}
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => setTab("in")}
          >
            {dict.auth.tabSignIn}
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => setTab("up")}
          >
            {dict.auth.tabSignUp}
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>{dict.auth.fieldUser}</label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder={dict.auth.userPlaceholder}
            />
          </div>
          {tab === "up" && (
            <div className="field slide-in">
              <label>{dict.auth.fieldEmail}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={dict.auth.emailPlaceholder}
              />
            </div>
          )}
          <div className="field">
            <label>{dict.auth.fieldPassword}</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={dict.auth.passwordPlaceholder}
            />
          </div>

          <button
            className="btn lg"
            type="submit"
            style={{ width: "100%", marginTop: 8 }}
          >
            {tab === "in" ? dict.auth.submitSignIn : dict.auth.submitSignUp}
          </button>
        </form>

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          {dict.auth.guestButton}
        </button>

        <div className="auth-divider">{dict.auth.socialDivider}</div>
        <div className="social">
          <button className="btn ghost" type="button">
            {dict.auth.googleButton}
          </button>
          <button className="btn ghost" type="button">
            {dict.auth.githubButton}
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          {dict.auth.termsLine}
        </div>
      </div>
    </div>
  );
}
