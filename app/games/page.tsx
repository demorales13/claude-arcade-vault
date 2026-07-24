import { getGames } from "@/lib/data/games";
import { GamesBrowser } from "@/components/games-browser";

export default async function GamesPage() {
  const games = await getGames();

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <GamesBrowser games={games} />
    </div>
  );
}
