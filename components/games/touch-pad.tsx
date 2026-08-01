"use client";

import { memo, useCallback, useEffect, useRef } from "react";

export type TouchPadButton = {
  code: string;
  label: string;
  ariaLabel: string;
  repeat?: boolean;
};

export type TouchPadDpad = {
  up?: string;
  down?: string;
  left?: string;
  right?: string;
};

export type TouchPadProps = {
  dpad: TouchPadDpad; // celdas sin código: se dibujan atenuadas e inertes
  dpadRepeat?: boolean;
  buttonA?: TouchPadButton; // círculo grande
  buttonB?: TouchPadButton; // círculo pequeño
  disabled?: boolean;
  onKey: (code: string, pressed: boolean) => void;
};

const REPEAT_DELAY = 250;
const REPEAT_INTERVAL = 100;

const DPAD_LABELS: Record<keyof TouchPadDpad, string> = {
  up: "Mover arriba",
  down: "Mover abajo",
  left: "Mover izquierda",
  right: "Mover derecha",
};

const DPAD_ARROW_PATHS: Record<keyof TouchPadDpad, string> = {
  up: "M12 4 L20 16 L4 16 Z",
  right: "M8 4 L20 12 L8 20 Z",
  down: "M4 8 L20 8 L12 20 Z",
  left: "M16 4 L16 20 L4 12 Z",
};

/**
 * Mando táctil único y compartido: cruz de 4 direcciones + 2 botones
 * circulares, con la misma geometría en los cuatro juegos. Una celda sin
 * código asociado se dibuja atenuada e inerte en vez de ocultarse, para que
 * el mando nunca cambie de forma entre juegos.
 */
export const TouchPad = memo(function TouchPad({
  dpad,
  dpadRepeat = false,
  buttonA,
  buttonB,
  disabled = false,
  onKey,
}: TouchPadProps) {
  const heldCodes = useRef<Set<string>>(new Set());
  const repeatTimers = useRef<
    Map<string, { timeout: number; interval: number | null }>
  >(new Map());

  const clearRepeat = useCallback((code: string) => {
    const timer = repeatTimers.current.get(code);
    if (!timer) return;
    window.clearTimeout(timer.timeout);
    if (timer.interval !== null) window.clearInterval(timer.interval);
    repeatTimers.current.delete(code);
  }, []);

  const press = useCallback(
    (code: string, repeat: boolean) => {
      heldCodes.current.add(code);
      onKey(code, true);
      if (!repeat) return;
      clearRepeat(code);
      const timeout = window.setTimeout(() => {
        const interval = window.setInterval(
          () => onKey(code, true),
          REPEAT_INTERVAL,
        );
        repeatTimers.current.set(code, { timeout, interval });
      }, REPEAT_DELAY);
      repeatTimers.current.set(code, { timeout, interval: null });
    },
    [onKey, clearRepeat],
  );

  const release = useCallback(
    (code: string) => {
      if (!heldCodes.current.has(code)) return;
      heldCodes.current.delete(code);
      clearRepeat(code);
      onKey(code, false);
    },
    [onKey, clearRepeat],
  );

  useEffect(() => {
    if (!disabled) return;
    for (const code of Array.from(heldCodes.current)) release(code);
  }, [disabled, release]);

  useEffect(() => {
    return () => {
      for (const code of Array.from(heldCodes.current)) clearRepeat(code);
    };
  }, [clearRepeat]);

  const bind = (code: string | undefined, repeat: boolean) => {
    if (!code) return undefined;
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        if (disabled) return;
        press(code, repeat);
      },
      onPointerUp: () => release(code),
      onPointerLeave: () => release(code),
      onPointerCancel: () => release(code),
    };
  };

  const dpadCell = (key: keyof TouchPadDpad) => {
    const code = dpad[key];
    const inactive = !code;
    // "up" es la acción de rotar/propulsar en los juegos que la usan, nunca
    // un movimiento discreto: no debe auto-repetir aunque dpadRepeat esté
    // activo para el resto de la cruz (TETRIS: mantener ROTAR gira una sola
    // vez; ASTEROIDES: mantener PROPULSAR ya empuja de forma continua).
    const repeat = key === "up" ? false : dpadRepeat;
    return (
      <button
        type="button"
        className={`touch-pad-arm touch-pad-arm-${key}${inactive ? " is-inactive" : ""}`}
        aria-label={DPAD_LABELS[key]}
        aria-hidden={inactive}
        disabled={disabled || inactive}
        {...bind(code, repeat)}
      >
        <svg
          className="touch-pad-arm-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d={DPAD_ARROW_PATHS[key]} fill="currentColor" />
        </svg>
      </button>
    );
  };

  const actionButton = (
    btn: TouchPadButton | undefined,
    variant: "a" | "b",
  ) => {
    const inactive = !btn;
    return (
      <button
        type="button"
        className={`touch-pad-circle touch-pad-circle-${variant}${inactive ? " is-inactive" : ""}`}
        aria-label={btn?.ariaLabel ?? "Sin función en este juego"}
        aria-hidden={inactive}
        disabled={disabled || inactive}
        {...bind(btn?.code, btn?.repeat ?? false)}
      >
        <span className="touch-pad-circle-ring" aria-hidden="true" />
        <span className="touch-pad-circle-label">{btn?.label ?? ""}</span>
      </button>
    );
  };

  return (
    <div className="touch-pad" aria-hidden={disabled}>
      <div className="touch-pad-shell">
        <div className="touch-pad-dpad">
          {dpadCell("up")}
          {dpadCell("left")}
          <div className="touch-pad-hub" aria-hidden="true">
            <span className="touch-pad-hub-gem" />
          </div>
          {dpadCell("right")}
          {dpadCell("down")}
        </div>
        <div className="touch-pad-buttons">
          {actionButton(buttonA, "a")}
          {actionButton(buttonB, "b")}
        </div>
      </div>
    </div>
  );
});
