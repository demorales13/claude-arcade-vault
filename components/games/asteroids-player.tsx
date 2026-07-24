"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GameWithStats } from "@/lib/data/games";
import { insertScore } from "@/lib/data/scores";
import { GameOverModal } from "@/components/game-over-modal";
import {
  createAsteroidsGame,
  type AsteroidsCallbacks,
  type AsteroidsGame,
} from "@/components/games/asteroids/engine";

function readUserName(): string {
  try {
    const u = JSON.parse(localStorage.getItem("av_user") || "null");
    return u?.name || "INVITADO";
  } catch {
    return "INVITADO";
  }
}

export function AsteroidsPlayer({ game }: { game: GameWithStats }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [tripleShot, setTripleShot] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(readUserName());
  }, []);

  const buildCallbacks = (): AsteroidsCallbacks => ({
    onScoreChange: setScore,
    onLivesChange: setLives,
    onLevelChange: setLevel,
    onTripleShotChange: setTripleShot,
    onGameOver: (finalScore) => {
      setScore(finalScore);
      setOver(true);
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const instance = createAsteroidsGame(canvas, buildCallbacks());
    gameRef.current = instance;

    return () => {
      instance.destroy();
      gameRef.current = null;
    };
  }, []);

  const togglePause = () => {
    if (paused) {
      gameRef.current?.resume();
      setPaused(false);
    } else {
      gameRef.current?.pause();
      setPaused(true);
    }
  };

  const endGame = () => {
    gameRef.current?.forceGameOver();
  };

  const restart = () => {
    const canvas = canvasRef.current;
    gameRef.current?.destroy();
    gameRef.current = null;
    setPaused(false);
    setOver(false);
    setSaved(false);

    if (canvas) {
      gameRef.current = createAsteroidsGame(canvas, buildCallbacks());
    }
  };

  const bindKey = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      gameRef.current?.setKey(code, true);
    },
    onPointerUp: () => gameRef.current?.setKey(code, false),
    onPointerLeave: () => gameRef.current?.setKey(code, false),
    onPointerCancel: () => gameRef.current?.setKey(code, false),
  });

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
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
          {tripleShot > 0 && (
            <div className="hud-stat">
              <div className="l">Disparo Triple</div>
              <div className="v">{tripleShot.toFixed(1)}s</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link className="btn ghost" href={`/games/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="asteroids-canvas"
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
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <div className="asteroids-touch-controls">
        <div className="td-pad">
          <button
            className="td-btn"
            aria-label="Rotar izquierda"
            {...bindKey("ArrowLeft")}
          >
            ◀
          </button>
          <button
            className="td-btn"
            aria-label="Rotar derecha"
            {...bindKey("ArrowRight")}
          >
            ▶
          </button>
        </div>
        <div className="td-actions">
          <button
            className="td-btn td-thrust"
            aria-label="Propulsar"
            {...bindKey("ArrowUp")}
          >
            PROPULSAR
          </button>
          <button
            className="td-btn td-fire"
            aria-label="Disparar"
            {...bindKey("Space")}
          >
            DISPARAR
          </button>
        </div>
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
