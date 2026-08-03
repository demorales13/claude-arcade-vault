# Juegos implementados

Juegos con motor real, jugables en `/games/<id>/play`, con catálogo y puntuaciones en Supabase. Ver
`.claude/skills/add-game/recipe.md` para cómo se conecta cada uno.

## ASTEROIDES (`asteroids`)

- **Categoría / color:** SHOOTER · cyan
- **Spec:** `specs/05-asteroids-game.md` (motor), `specs/06-leaderboard-catalogo-supabase.md` (catálogo/leaderboard reales)
- **Motor:** `components/games/asteroids/engine.ts` · **Player:** `components/games/asteroids-player.tsx`
- Nave triangular con rotación e inercia en gravedad cero; dispara para fragmentar asteroides grandes
  en medianos y pequeños. 3 vidas, power-up de disparo triple.

## TETRIS (`tetris`)

- **Categoría / color:** PUZZLE · magenta
- **Spec:** `specs/07-tetris-game.md`
- **Motor:** `components/games/tetris/engine.ts` · **Player:** `components/games/tetris-player.tsx`
- Los siete tetrominós caen en un tablero de 10×20 que acelera por nivel. Rotación, desplazamiento,
  combos, TETRIS de cuatro líneas, T-Spin y Perfect Clear. Incluye selector de skin y toggle de sonido
  persistidos en `localStorage`.

## ARKANOID (`arkanoid`)

- **Categoría / color:** ARCADE · yellow
- **Spec:** `specs/08-arkanoid-game.md`
- **Motor:** `components/games/arkanoid/engine.ts` · **Player:** `components/games/arkanoid-player.tsx`
- Rompe tres niveles de ladrillos (cuadrícula completa, diamante hueco, tablero de ajedrez) con una
  paleta que angula el rebote hasta 60°; 3 vidas, la bola acelera 5% por nivel. Incluye toggle de
  sonido persistido en `localStorage`.

## SERPIENTE (`snake`)

- **Categoría / color:** ARCADE · green
- **Spec:** `specs/09-snake-game.md`
- **Motor:** `components/games/snake/engine.ts` · **Player:** `components/games/snake-player.tsx`
- Snake clásico diseñado desde cero (no hay `game.js` de referencia): grid 20×20 sin wrapping, crece
  al comer fruta (arte tomado del atlas `references/snake-assets/`), niveles por velocidad, choque
  contra el propio cuerpo o el borde termina la partida.

## INVASIÓN (`invasion`)

- **Categoría / color:** SHOOTER · magenta
- **Spec:** `specs/16-invasion-formacion-basica.md`
- **Motor:** `components/games/invasion/engine.ts` · **Player:** `components/games/invasion-player.tsx`
- Cañón fijo en la base dispara contra una formación de 40 alienígenas (5×8) que se mueve
  lateralmente y desciende un escalón al chocar con cualquier borde; la velocidad de avance
  aumenta a medida que quedan menos alienígenas vivos. Una sola bala del jugador en pantalla a
  la vez, balas enemigas aleatorias, puntuación por fila, 3 vidas, sin escudos ni power-ups.

## CRUCE (`crossing`)

- **Categoría / color:** ARCADE · cyan
- **Spec:** `specs/15-cruce-clasico.md`
- **Motor:** `components/games/crossing/engine.ts` · **Player:** `components/games/crossing-player.tsx`
- Cruce de carriles clásico diseñado desde cero: tablero fijo de 11×13 celdas (metas, río con
  troncos, mediana, calzada con vehículos, salida), salto discreto por celda con bloqueo de
  repetición (`HOP_LOCK_MS`), animación de salto con arco y animación de golpe/reaparición al
  perder una vida, 3 vidas, 5 metas por nivel. Incluye selector de skin (`clasico`, `neon`,
  `retro`) persistido en `localStorage`.

---

Todos comparten el mismo flujo genérico: HUD, marco `.crt`, guardado de puntuación vía
`lib/data/scores.ts` (tabla `scores` en Supabase), y `best`/`plays` calculados por la vista
`games_with_stats` — nada de esto se repite por juego.
