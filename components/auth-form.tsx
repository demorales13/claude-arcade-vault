"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/lib/i18n/translations";

function saveUser(name: string) {
  try {
    localStorage.setItem("av_user", JSON.stringify({ name }));
  } catch {}
}

function normalizeName(name: string) {
  return (name || "PLAYER1").toUpperCase().slice(0, 10);
}

function mapAuthError(code: string | undefined, dict: Dictionary): string {
  switch (code) {
    case "invalid_credentials":
      return dict.auth.errorInvalidCredentials;
    case "email_not_confirmed":
      return dict.auth.errorEmailNotConfirmed;
    case "user_already_exists":
    case "email_exists":
      return dict.auth.errorEmailTaken;
    default:
      return dict.auth.errorGeneric;
  }
}

export function AuthForm() {
  const router = useRouter();
  const { dict } = useLanguage();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmailSent, setCheckEmailSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    if (tab === "up") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { display_name: normalizeName(user) } },
      });
      setLoading(false);

      if (signUpError) {
        setError(mapAuthError(signUpError.code, dict));
        return;
      }

      setCheckEmailSent(true);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    setLoading(false);

    if (signInError) {
      setError(mapAuthError(signInError.code, dict));
      return;
    }

    router.push("/");
  };

  const playAsGuest = () => {
    saveUser("INVITADO");
    router.push("/");
  };

  const switchTab = (next: "in" | "up") => {
    setTab(next);
    setError(null);
    setCheckEmailSent(false);
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
            onClick={() => switchTab("in")}
          >
            {dict.auth.tabSignIn}
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => switchTab("up")}
          >
            {dict.auth.tabSignUp}
          </button>
        </div>

        {tab === "up" && checkEmailSent ? (
          <div className="field slide-in" style={{ textAlign: "center" }}>
            <h3 className="neon-cyan" style={{ fontSize: 15 }}>
              {dict.auth.checkEmailTitle}
            </h3>
            <p
              className="mono"
              style={{
                fontSize: 12,
                color: "var(--ink-faint)",
                marginTop: 10,
                lineHeight: 1.6,
              }}
            >
              {dict.auth.checkEmailBody}
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            {tab === "up" && (
              <div className="field slide-in">
                <label>{dict.auth.fieldUser}</label>
                <input
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder={dict.auth.userPlaceholder}
                />
              </div>
            )}
            <div className="field">
              <label>{dict.auth.fieldEmail}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={dict.auth.emailPlaceholder}
              />
            </div>
            <div className="field">
              <label>{dict.auth.fieldPassword}</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder={dict.auth.passwordPlaceholder}
              />
            </div>

            {error && (
              <div
                className="mono slide-in"
                style={{
                  fontSize: 11,
                  color: "var(--magenta)",
                  marginTop: 4,
                }}
              >
                {error}
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              style={{ width: "100%", marginTop: 8 }}
            >
              {tab === "in"
                ? loading
                  ? dict.auth.submitSignInPending
                  : dict.auth.submitSignIn
                : loading
                  ? dict.auth.submitSignUpPending
                  : dict.auth.submitSignUp}
            </button>
          </form>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          {dict.auth.guestButton}
        </button>

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
