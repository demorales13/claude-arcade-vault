import { getGames } from "@/lib/data/games";
import { GamesBrowser } from "@/components/games-browser";
import { GamesCatalogHero } from "@/components/games-catalog-hero";

export default async function GamesPage() {
  const games = await getGames();

  return (
    <div className="fade-in">
      <GamesCatalogHero />
      <GamesBrowser games={games} />
    </div>
  );
}
