/**
 * Sistema de skins compartido entre juegos.
 *
 * Cada juego expone al menos los tres skins estándar (`clasico`, `neon`,
 * `retro`) definidos aquí, más los que le sean propios (p. ej. Tetris añade
 * `pastel`). Este módulo solo define tipos y helpers de persistencia en
 * `localStorage`; los motores (`engine.ts`) nunca lo importan salvo por su
 * tipo `SkinId`, que se borra en tiempo de compilación.
 */

export type SkinId = "clasico" | "neon" | "retro";

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "Clásico",
  neon: "Neón",
  retro: "Retro",
};

export const DEFAULT_SKIN: SkinId = "clasico";

const BASE_SKINS: readonly SkinId[] = ["clasico", "neon", "retro"];

function storageKey(gameId: string): string {
  return `av_${gameId}_skin`;
}

/**
 * Lee el skin guardado para `gameId` en `localStorage`, validándolo contra
 * los tres skins estándar más cualquier skin extra propio del juego (p. ej.
 * `pastel` en Tetris). Si el valor guardado es inválido, no existe, o
 * `localStorage` lanza (SSR, modo privado, etc.), cae a `DEFAULT_SKIN`.
 */
export function readStoredSkin<T extends string = SkinId>(
  gameId: string,
  extraSkins: readonly string[] = [],
): T {
  const validSkins: readonly string[] = [...BASE_SKINS, ...extraSkins];
  try {
    const stored = localStorage.getItem(storageKey(gameId));
    if (stored && validSkins.includes(stored)) return stored as T;
    return DEFAULT_SKIN as T;
  } catch {
    return DEFAULT_SKIN as T;
  }
}

/** Persiste el skin elegido para `gameId` en `localStorage`. */
export function writeStoredSkin(gameId: string, skin: string): void {
  try {
    localStorage.setItem(storageKey(gameId), skin);
  } catch {
    // localStorage no disponible; se ignora silenciosamente.
  }
}
