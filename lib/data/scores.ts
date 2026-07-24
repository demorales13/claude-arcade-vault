import { createClient } from "@/lib/supabase/client";

export async function insertScore(entry: {
  game: string;
  score: number;
  name: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.game,
    player_name: entry.name,
    score: entry.score,
  });

  if (error) throw error;
}
