"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/language-context";

type SessionState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "no-profile" }
  | { status: "ready"; playerName: string };

export function GameOverModal({
  score,
  saved,
  onSave,
  onRestart,
  backHref,
}: {
  score: number;
  saved: boolean;
  onSave: (playerName: string) => Promise<void>;
  onRestart: () => void;
  backHref: string;
}) {
  const { dict } = useLanguage();
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active) return;
      if (!user) {
        setSession({ status: "guest" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      if (!profile?.username) {
        setSession({ status: "no-profile" });
        return;
      }

      setSession({ status: "ready", playerName: profile.username });
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (session.status !== "ready") return;
    setPending(true);
    setError(null);
    try {
      await onSave(session.playerName);
    } catch {
      setError(dict.gameOver.saveError);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="modal-bd">
      <div className="modal">
        <h2>FIN DEL JUEGO</h2>
        <div className="final-label">PUNTUACIÓN FINAL</div>
        <div className="final">{score.toLocaleString("es-ES")}</div>
        {!saved ? (
          <>
            {session.status === "ready" && (
              <div className="input-row">
                <div className="final-label" style={{ textAlign: "left" }}>
                  {session.playerName}
                </div>
                <button
                  className="btn yellow"
                  onClick={handleSave}
                  disabled={pending}
                >
                  {pending ? dict.gameOver.saving : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            )}
            {session.status === "guest" && (
              <div
                className="input-row"
                style={{ flexDirection: "column", alignItems: "center" }}
              >
                <div className="mono" style={{ fontSize: 12 }}>
                  {dict.gameOver.guestCannotSave}
                </div>
                <Link className="btn ghost" href="/login">
                  {dict.gameOver.signInToSave}
                </Link>
              </div>
            )}
            {session.status === "no-profile" && (
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  color: "var(--magenta)",
                  margin: "22px 0 12px",
                }}
              >
                {dict.gameOver.saveError}
              </div>
            )}
            {error && (
              <div
                className="mono"
                style={{ fontSize: 12, color: "var(--magenta)", marginTop: 10 }}
              >
                {error}
              </div>
            )}
          </>
        ) : (
          <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
        )}
        <div className="actions">
          <button className="btn" onClick={onRestart}>
            JUGAR DE NUEVO
          </button>
          <Link className="btn magenta" href={backHref}>
            VOLVER AL VAULT
          </Link>
        </div>
      </div>
    </div>
  );
}
