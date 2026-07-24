"use server";

import { getTopScores } from "@/lib/data/games";
import type { ScoreRow } from "@/app/data/games";

export async function fetchTopScores(gameId: string): Promise<ScoreRow[]> {
  return getTopScores(gameId, 12);
}
