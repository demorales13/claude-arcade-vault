import { notFound } from "next/navigation";
import { getGame, getTopScores } from "@/lib/data/games";
import { GameDetailContent } from "@/components/game-detail-content";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const scores = await getTopScores(id, 10);

  return <GameDetailContent game={game} scores={scores} />;
}
