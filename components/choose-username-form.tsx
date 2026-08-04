"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { claimUsername } from "@/app/actions/username";

export function ChooseUsernameForm() {
  const router = useRouter();
  const { dict } = useLanguage();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError(dict.auth.errorUsernameEmpty);
      return;
    }

    setLoading(true);
    const result = await claimUsername(username);
    setLoading(false);

    if (!result.ok) {
      if (result.error === "taken") {
        setError(dict.auth.errorUsernameTaken);
      } else if (result.error === "invalid") {
        setError(dict.auth.errorUsernameInvalid);
      } else {
        setError(dict.auth.errorGeneric);
      }
      return;
    }

    router.push("/");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">{dict.auth.chooseUsernameTitle}</h2>
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
            <label>{dict.auth.fieldUser}</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={dict.auth.userPlaceholder}
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
              ? dict.auth.submitChooseUsernamePending
              : dict.auth.submitChooseUsername}
          </button>
        </form>
      </div>
    </div>
  );
}
