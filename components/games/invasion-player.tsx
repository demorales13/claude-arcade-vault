"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GameWithStats } from "@/lib/data/games";
import { insertScore } from "@/lib/data/scores";
import { GameOverModal } from "@/components/game-over-modal";
import { TouchPad } from "@/components/games/touch-pad";
import { HudMenu } from "@/components/games/hud-menu";
import {
  createInvasionGame,
  type InvasionCallbacks,
  type InvasionGame,
} from "@/components/games/invasion/engine";
import { useLanguage } from "@/lib/i18n/language-context";
import { localizedGameText } from "@/lib/i18n/localize-game";
import { setupHiDpiCanvas } from "@/lib/canvas-hidpi";

const INVASION_DPAD = {
  left: "ArrowLeft",
  right: "ArrowRight",
} as const;

const INVASION_BUTTON_A = {
  code: "Space",
  label: "DISPARAR",
  ariaLabel: "Disparar",
} as const;

function readUserName(): string {
  try {
    const u = JSON.parse(localStorage.getItem("av_user") || "null");
    return u?.name || "INVITADO";
  } catch {
    return "INVITADO";
  }
}

export function InvasionPlayer({ game }: { game: GameWithStats }) {
  const { language } = useLanguage();
  const { title } = localizedGameText(game, language);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<InvasionGame | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(readUserName());
  }, []);

  const buildCallbacks = (): InvasionCallbacks => ({
    onScoreChange: setScore,
    onLivesChange: setLives,
    onLevelChange: setLevel,
    onGameOver: (finalScore) => {
      setScore(finalScore);
      setOver(true);
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setupHiDpiCanvas(canvas, 800, 600);
    const instance = createInvasionGame(canvas, buildCallbacks());
    gameRef.current = instance;

    return () => {
      instance.destroy();
      gameRef.current = null;
    };
  }, []);

  const togglePause = useCallback(() => {
    if (paused) {
      gameRef.current?.resume();
      setPaused(false);
    } else {
      gameRef.current?.pause();
      setPaused(true);
    }
  }, [paused]);

  const endGame = useCallback(() => {
    gameRef.current?.forceGameOver();
  }, []);

  const handleTouchKey = useCallback((code: string, pressed: boolean) => {
    gameRef.current?.setKey(code, pressed);
  }, []);

  const restart = () => {
    const canvas = canvasRef.current;
    gameRef.current?.destroy();
    gameRef.current = null;
    setPaused(false);
    setOver(false);
    setSaved(false);

    if (canvas) {
      gameRef.current = createInvasionGame(canvas, buildCallbacks());
    }
  };

  const hudMenuChildren = useMemo(
    () => (
      <>
        <div className="hud-stat hud-menu-player-dup">
          <div className="l">Jugador</div>
          <div className="v" style={{ color: "var(--ink)" }}>
            {name}
          </div>
        </div>
        <button className="btn yellow" onClick={togglePause}>
          {paused ? "REANUDAR" : "PAUSA"}
        </button>
        <button className="btn magenta" onClick={endGame}>
          FIN
        </button>
        <Link className="btn ghost" href={`/games/${game.id}`}>
          SALIR
        </Link>
      </>
    ),
    [name, paused, togglePause, endGame, game.id],
  );

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat hud-stat-player">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">
              {"♥ ".repeat(Math.max(lives, 0)).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <HudMenu>{hudMenuChildren}</HudMenu>
      </div>

      <div className="crt-stage">
        <div className="crt">
          <div className="crt-screen">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="invasion-canvas"
            />
            {paused && (
              <div
                className="crt-content"
                style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
              >
                <div>
                  <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                    EN PAUSA
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--ink-dim)",
                      marginTop: 10,
                      letterSpacing: "0.16em",
                    }}
                  >
                    PULSA REANUDAR PARA CONTINUAR
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="crt-bottom">
            <span className="led">SEÑAL OK</span>
            <span>{title} · CRT-83 · 60 HZ</span>
            <span>CARGA · 1MB</span>
          </div>
        </div>
        <TouchPad
          dpad={INVASION_DPAD}
          buttonA={INVASION_BUTTON_A}
          disabled={paused || over}
          onKey={handleTouchKey}
        />
      </div>

      {over && (
        <GameOverModal
          score={score}
          name={name}
          onNameChange={setName}
          saved={saved}
          onSave={async () => {
            try {
              await insertScore({ game: game.id, score, name });
              setSaved(true);
            } catch (err) {
              console.error("No se pudo guardar la puntuación", err);
            }
          }}
          onRestart={restart}
          backHref="/games"
        />
      )}
    </div>
  );
}
