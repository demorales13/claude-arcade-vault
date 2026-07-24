"use client";

import Link from "next/link";

export function GameOverModal({
  score,
  name,
  onNameChange,
  saved,
  onSave,
  onRestart,
  backHref,
}: {
  score: number;
  name: string;
  onNameChange: (name: string) => void;
  saved: boolean;
  onSave: () => void;
  onRestart: () => void;
  backHref: string;
}) {
  return (
    <div className="modal-bd">
      <div className="modal">
        <h2>FIN DEL JUEGO</h2>
        <div className="final-label">PUNTUACIÓN FINAL</div>
        <div className="final">{score.toLocaleString("es-ES")}</div>
        {!saved ? (
          <div className="input-row">
            <input
              value={name}
              onChange={(e) =>
                onNameChange(e.target.value.toUpperCase().slice(0, 10))
              }
              placeholder="TUS INICIALES"
            />
            <button className="btn yellow" onClick={onSave}>
              GUARDAR PUNTUACIÓN
            </button>
          </div>
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
