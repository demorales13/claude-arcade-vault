"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GameWithStats } from "@/lib/data/games";
import { insertScore } from "@/lib/data/scores";
import { GameOverModal } from "@/components/game-over-modal";
import {
  createArkanoidGame,
  type ArkanoidCallbacks,
  type ArkanoidGame,
  type ArkanoidOutcome,
} from "@/components/games/arkanoid/engine";

const SOUND_STORAGE_KEY = "av_arkanoid_sound";

function readUserName(): string {
  try {
    const u = JSON.parse(localStorage.getItem("av_user") || "null");
    return u?.name || "INVITADO";
  } catch {
    return "INVITADO";
  }
}

function readStoredSound(): boolean {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function ArkanoidPlayer({ game }: { game: GameWithStats }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ArkanoidGame | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [outcome, setOutcome] = useState<ArkanoidOutcome | null>(null);
  const [levelCleared, setLevelCleared] = useState<number | null>(null);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setName(readUserName());
  }, []);

  const buildCallbacks = (): ArkanoidCallbacks => ({
    onScoreChange: setScore,
    onLivesChange: setLives,
    onLevelChange: setLevel,
    onLevelCleared: (clearedLevel) => setLevelCleared(clearedLevel),
    onSoundToggled: (enabled) => {
      setSoundOn(enabled);
      gameRef.current?.setSoundEnabled(enabled);
      try {
        localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");
      } catch {
        // localStorage no disponible; se ignora.
      }
    },
    onGameOver: (finalScore, finalOutcome) => {
      setScore(finalScore);
      setOutcome(finalOutcome);
      setOver(true);
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialSound = readStoredSound();
    setSoundOn(initialSound);

    const instance = createArkanoidGame(canvas, buildCallbacks(), {
      soundEnabled: initialSound,
    });
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "KeyP" || over) return;
      togglePause();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [over, paused]);

  const advanceLevel = () => {
    gameRef.current?.continueLevel();
    setLevelCleared(null);
  };

  useEffect(() => {
    if (levelCleared === null || over) return;
    function onKeyDown() {
      advanceLevel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [levelCleared, over]);

  const endGame = () => {
    gameRef.current?.forceGameOver();
  };

  const restart = () => {
    const canvas = canvasRef.current;
    gameRef.current?.destroy();
    gameRef.current = null;
    setPaused(false);
    setOver(false);
    setOutcome(null);
    setLevelCleared(null);
    setSaved(false);

    if (canvas) {
      gameRef.current = createArkanoidGame(canvas, buildCallbacks(), {
        soundEnabled: soundOn,
      });
    }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    gameRef.current?.setSoundEnabled(next);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // localStorage no disponible; se ignora.
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
        </div>
        <div className="hud-actions">
          <button className="btn ghost" onClick={toggleSound}>
            {soundOn ? "SONIDO ON" : "SONIDO OFF"}
          </button>
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
            className="arkanoid-canvas"
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
          {levelCleared !== null && !over && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.72)", zIndex: 5 }}
              onClick={advanceLevel}
              onPointerDown={advanceLevel}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 20 }}>
                  NIVEL {levelCleared} SUPERADO
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
                  PULSA UNA TECLA PARA CONTINUAR
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

      <div className="arkanoid-touch-controls">
        <div className="td-pad">
          <button
            className="td-btn"
            aria-label="Mover paleta a la izquierda"
            {...bindKey("ArrowLeft")}
          >
            ◀
          </button>
          <button
            className="td-btn"
            aria-label="Mover paleta a la derecha"
            {...bindKey("ArrowRight")}
          >
            ▶
          </button>
        </div>
      </div>

      {over && outcome === "victory" && (
        <div className="arkanoid-victory">¡VICTORIA!</div>
      )}

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
