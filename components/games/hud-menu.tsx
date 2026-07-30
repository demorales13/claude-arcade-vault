"use client";

import { useEffect, useState } from "react";

export type HudMenuProps = {
  children: React.ReactNode;
};

function fullscreenSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.documentElement.requestFullscreen === "function"
  );
}

/**
 * Envuelve el contenido de acciones del HUD (jugador, skin, pausa/fin/salir).
 * En escritorio se renderiza inline, igual que hoy; en modo inmersivo se
 * colapsa tras un botón `≡`. Puramente presentacional: no recibe estado del
 * juego, solo decide cómo mostrar lo que se le pasa.
 */
export function HudMenu({ children }: HudMenuProps) {
  const [open, setOpen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setCanFullscreen(fullscreenSupported());
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const fullscreenButton = canFullscreen && (
    <button
      type="button"
      className="btn ghost"
      onClick={toggleFullscreen}
      aria-label={
        isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"
      }
    >
      {isFullscreen ? "SALIR PANTALLA COMPLETA" : "PANTALLA COMPLETA"}
    </button>
  );

  return (
    <div className="hud-menu">
      <div className="hud-actions hud-menu-inline">{children}</div>
      <button
        type="button"
        className="hud-menu-toggle"
        aria-label="Abrir menú"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ≡
      </button>
      <div className={`hud-menu-panel${open ? " is-open" : ""}`}>
        {children}
        {fullscreenButton}
      </div>
    </div>
  );
}
