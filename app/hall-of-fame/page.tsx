import { getGames, getTopScores } from "@/lib/data/games";
import { HallOfFameBoard } from "@/components/hall-of-fame-board";

export default async function HallOfFamePage() {
  const games = await getGames();
  const firstGame = games[0];
  const initialScores = firstGame ? await getTopScores(firstGame.id, 12) : [];

  return (
    <HallOfFameBoard
      games={games}
      initialGameId={firstGame?.id ?? ""}
      initialScores={initialScores}
    />
  );
}
