export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;
  title: string;
  title_en: string | null;
  short: string;
  short_en: string | null;
  long: string;
  long_en: string | null;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
};

export type GameWithStats = Game & { best: number; plays: number };

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};

export const CATS: ("TODOS" | GameCategory)[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];
