"use client";

/**
 * Selector de skin genérico sobre `.hud-select`. `T` es el union de skins del
 * juego que lo usa (normalmente `SkinId` de `lib/skins.ts`, o un superset si
 * el juego añade skins propios, como `pastel` en Tetris).
 */
export function SkinSelector<T extends string>({
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
