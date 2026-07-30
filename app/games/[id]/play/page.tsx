import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/data/games";
import { GamePlayer } from "@/components/game-player";
import { AsteroidsPlayer } from "@/components/games/asteroids-player";
import { TetrisPlayer } from "@/components/games/tetris-player";
import { ArkanoidPlayer } from "@/components/games/arkanoid-player";
import { SnakePlayer } from "@/components/games/snake-player";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  if (game.id === "asteroids") return <AsteroidsPlayer game={game} />;
  if (game.id === "tetris") return <TetrisPlayer game={game} />;
  if (game.id === "arkanoid") return <ArkanoidPlayer game={game} />;
  if (game.id === "snake") return <SnakePlayer game={game} />;

  return <GamePlayer game={game} />;
}
