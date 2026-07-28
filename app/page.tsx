import { getGames, getRecentScores, getTopPlayers } from "@/lib/data/games";
import { HomeContent } from "@/components/home-content";

export default async function HomePage() {
  const [games, recentScores, topPlayers] = await Promise.all([
    getGames(),
    getRecentScores(7),
    getTopPlayers(5),
  ]);

  return (
    <HomeContent
      games={games}
      recentScores={recentScores}
      topPlayers={topPlayers}
    />
  );
}
