import { createClient } from "@/lib/supabase/server";
import type { GameWithStats, ScoreRow } from "@/app/data/games";

export type { GameWithStats } from "@/app/data/games";

type ScoreRowRaw = {
  player_name: string;
  score: number;
  created_at: string;
};

export async function getGames(): Promise<GameWithStats[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games_with_stats")
    .select("*")
    .order("id");

  if (error) throw error;
  return (data ?? []) as GameWithStats[];
}

export async function getGame(id: string): Promise<GameWithStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games_with_stats")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as GameWithStats | null;
}

export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as ScoreRowRaw[]).map((row, i) => ({
    rank: i + 1,
    name: row.player_name,
    score: row.score,
    date: formatDate(row.created_at),
  }));
}

export async function getRecentScores(
  limit: number,
): Promise<{ player: string; game: string; score: number; at: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at, games(title)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (
    (data ?? []) as unknown as (ScoreRowRaw & {
      games: { title: string } | null;
    })[]
  ).map((row) => ({
    player: row.player_name,
    game: row.games?.title ?? "",
    score: row.score,
    at: timeAgo(row.created_at),
  }));
}

export async function getTopPlayers(
  limit: number,
): Promise<{ rank: number; player: string; score: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score");

  if (error) throw error;

  const bestByPlayer = new Map<string, number>();
  for (const row of (data ?? []) as Pick<
    ScoreRowRaw,
    "player_name" | "score"
  >[]) {
    const current = bestByPlayer.get(row.player_name) ?? 0;
    if (row.score > current) bestByPlayer.set(row.player_name, row.score);
  }

  return [...bestByPlayer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([player, score], i) => ({ rank: i + 1, player, score }));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
