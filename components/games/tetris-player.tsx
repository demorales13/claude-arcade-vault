"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GameWithStats } from "@/lib/data/games";
import { insertScore } from "@/lib/data/scores";
import { GameOverModal } from "@/components/game-over-modal";
import {
  createTetrisGame,
  SKIN_LABELS,
  type TetrisCallbacks,
  type TetrisGame,
  type TetrisSkin,
} from "@/components/games/tetris/engine";
import { useLanguage } from "@/lib/i18n/language-context";
import { localizedGameText } from "@/lib/i18n/localize-game";

const SKIN_STORAGE_KEY = "av_tetris_skin";
const SOUND_STORAGE_KEY = "av_tetris_sound";
const VALID_SKINS: TetrisSkin[] = ["retro", "neon", "pastel", "pixel"];

function readUserName(): string {
  try {
    const u = JSON.parse(localStorage.getItem("av_user") || "null");
    return u?.name || "INVITADO";
  } catch {
    return "INVITADO";
  }
}

function readStoredSkin(): TetrisSkin {
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    return (VALID_SKINS as string[]).includes(stored ?? "")
      ? (stored as TetrisSkin)
      : "neon";
  } catch {
    return "neon";
  }
}

function readStoredSound(): boolean {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

const TOUCH_REPEAT_DELAY = 250;
const TOUCH_REPEAT_INTERVAL = 100;

export function TetrisPlayer({ game }: { game: GameWithStats }) {
  const { language } = useLanguage();
  const { title } = localizedGameText(game, language);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisGame | null>(null);
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  const [skin, setSkin] = useState<TetrisSkin>("neon");
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setName(readUserName());
  }, []);

  const buildCallbacks = (): TetrisCallbacks => ({
    onScoreChange: setScore,
    onLinesChange: setLines,
    onLevelChange: setLevel,
    onComboChange: setCombo,
    onGameOver: (finalScore) => {
      setScore(finalScore);
      setOver(true);
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialSkin = readStoredSkin();
    const initialSound = readStoredSound();
    setSkin(initialSkin);
    setSoundOn(initialSound);

    const instance = createTetrisGame(canvas, buildCallbacks(), {
      skin: initialSkin,
      soundEnabled: initialSound,
    });
    gameRef.current = instance;

    return () => {
      instance.destroy();
      gameRef.current = null;
      clearTouchRepeat();
    };
  }, []);

  function clearTouchRepeat() {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }

  const bindKey = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      gameRef.current?.setKey(code, true);
      clearTouchRepeat();
      repeatTimeoutRef.current = window.setTimeout(() => {
        repeatIntervalRef.current = window.setInterval(() => {
          gameRef.current?.setKey(code, true);
        }, TOUCH_REPEAT_INTERVAL);
      }, TOUCH_REPEAT_DELAY);
    },
    onPointerUp: () => {
      clearTouchRepeat();
      gameRef.current?.setKey(code, false);
    },
    onPointerLeave: () => {
      clearTouchRepeat();
      gameRef.current?.setKey(code, false);
    },
    onPointerCancel: () => {
      clearTouchRepeat();
      gameRef.current?.setKey(code, false);
    },
  });

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
      gameRef.current = createTetrisGame(canvas, buildCallbacks(), {
        skin,
        soundEnabled: soundOn,
      });
    }
  };

  const handleSkinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSkin = e.target.value as TetrisSkin;
    setSkin(newSkin);
    gameRef.current?.setSkin(newSkin);
    localStorage.setItem(SKIN_STORAGE_KEY, newSkin);
    e.target.blur();
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    gameRef.current?.setSoundEnabled(next);
    localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
  };

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
            <div className="l">Líneas</div>
            <div className="v">{lines}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {combo > 1 && (
            <div className="hud-stat">
              <div className="l">Combo</div>
              <div className="v">x{combo}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <select
            className="hud-select"
            value={skin}
            onChange={handleSkinChange}
            aria-label="Cambiar skin visual"
          >
            {Object.entries(SKIN_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
            className="tetris-canvas"
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

      <div className="tetris-touch-controls">
        <div className="td-pad">
          <button
            className="td-btn"
            aria-label="Mover izquierda"
            {...bindKey("ArrowLeft")}
          >
            ◀
          </button>
          <button
            className="td-btn"
            aria-label="Bajar"
            {...bindKey("ArrowDown")}
          >
            ▼
          </button>
          <button
            className="td-btn"
            aria-label="Mover derecha"
            {...bindKey("ArrowRight")}
          >
            ▶
          </button>
        </div>
        <div className="td-actions">
          <button className="td-btn" aria-label="Rotar" {...bindKey("ArrowUp")}>
            ROTAR
          </button>
          <button
            className="td-btn td-fire"
            aria-label="Soltar pieza"
            {...bindKey("Space")}
          >
            SOLTAR
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
