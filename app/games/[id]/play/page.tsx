import { notFound } from "next/navigation";
import { GAMES } from "@/app/data/games";
import { GamePlayer } from "@/components/game-player";
import { AsteroidsPlayer } from "@/components/games/asteroids-player";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  if (game.id === "asteroids") return <AsteroidsPlayer game={game} />;

  return <GamePlayer game={game} />;
}
