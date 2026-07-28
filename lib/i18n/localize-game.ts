import type { Locale } from "./translations";

type LocalizableGame = {
  title: string;
  title_en: string | null;
  short: string;
  short_en: string | null;
  long: string;
  long_en: string | null;
};

export function localizedGameText(
  game: LocalizableGame,
  language: Locale,
): { title: string; short: string; long: string } {
  if (language !== "en") {
    return { title: game.title, short: game.short, long: game.long };
  }
  return {
    title: game.title_en || game.title,
    short: game.short_en || game.short,
    long: game.long_en || game.long,
  };
}
