"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { dict } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(dict.auth.errorPasswordMismatch);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(dict.auth.errorGeneric);
      return;
    }

    router.push("/");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">{dict.auth.updatePasswordTitle}</h2>
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

        <form onSubmit={submit}>
          <div className="field">
            <label>{dict.auth.fieldNewPassword}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={dict.auth.passwordPlaceholder}
            />
          </div>
          <div className="field">
            <label>{dict.auth.fieldConfirmPassword}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading
              ? dict.auth.submitUpdatePasswordPending
              : dict.auth.submitUpdatePassword}
          </button>
        </form>
      </div>
    </div>
  );
}
