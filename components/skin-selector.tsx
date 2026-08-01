"use client";

import { memo } from "react";

/**
 * Selector de skin genérico sobre `.hud-select`. `T` es el union de skins del
 * juego que lo usa (normalmente `SkinId` de `lib/skins.ts`, o un superset si
 * el juego añade skins propios, como `pastel` en Tetris).
 */
function SkinSelectorImpl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (skin: T) => void;
  options: Record<T, string>;
}) {
  return (
    <select
      className="hud-select"
      value={value}
      onChange={(e) => {
        onChange(e.target.value as T);
        e.target.blur();
      }}
      aria-label="Cambiar skin visual"
    >
      {Object.entries(options).map(([skinValue, label]) => (
        <option key={skinValue} value={skinValue}>
          {label as string}
        </option>
      ))}
    </select>
  );
}

// `memo` no conserva firmas genéricas por sí solo (colapsa `T` a `unknown`);
// el cast recupera la firma genérica de `SkinSelectorImpl` para que cada
// juego (Tetris con `pastel` incluido) siga infiriendo su propio `T`.
export const SkinSelector = memo(SkinSelectorImpl) as typeof SkinSelectorImpl;
