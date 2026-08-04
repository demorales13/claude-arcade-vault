"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const { dict } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmailSent, setCheckEmailSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth/confirm` },
    );
    setLoading(false);

    if (resetError) {
      setError(dict.auth.errorGeneric);
      return;
    }

    setCheckEmailSent(true);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">{dict.auth.forgotPasswordTitle}</h2>
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

        {checkEmailSent ? (
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
            <div className="field">
              <label>{dict.auth.fieldEmail}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={dict.auth.emailPlaceholder}
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
              {loading
                ? dict.auth.submitForgotPasswordPending
                : dict.auth.submitForgotPassword}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
