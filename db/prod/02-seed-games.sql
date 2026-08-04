-- Arcade Vault — catálogo inicial de juegos para PRODUCCIÓN.
--
-- Exportado del proyecto de DESARROLLO el 2026-08-04 (6 filas de `public.games`).
-- No incluye `scores` ni `profiles`: producción arranca con el leaderboard vacío
-- (misma decisión que specs/06-leaderboard-catalogo-supabase.md tomó para dev).
--
-- Idempotente: `on conflict (id) do nothing` permite re-ejecutar sin duplicar filas
-- ni pisar ediciones manuales que se hayan hecho ya en producción.
--
-- Requiere que db/prod/01-baseline.sql se haya ejecutado antes (tabla `games`).

insert into public.games
  (id, title, short, long, cat, cover, color, title_en, short_en, long_en)
values
  (
    'arkanoid',
    'ARKANOID',
    'Rompe el muro de ladrillos con la paleta y no dejes caer la bola.',
    'Tres niveles de ladrillos te separan de la victoria: una cuadrícula completa, un diamante hueco y un tablero de ajedrez. Mueve la paleta para devolver la bola, aprovecha los bordes para angular el rebote hasta sesenta grados y aguanta con tres vidas mientras la bola acelera un cinco por ciento en cada nivel.',
    'ARCADE',
    'cover-arkanoid',
    'yellow',
    'ARKANOID',
    'Smash the brick wall with the paddle and don''t let the ball drop.',
    'Three brick layouts stand between you and victory: a full grid, a hollow diamond, and a checkerboard. Move the paddle to return the ball, use the edges to angle the bounce up to sixty degrees, and hang on with three lives as the ball speeds up five percent each level.'
  ),
  (
    'asteroids',
    'ASTEROIDES',
    'Destruye asteroides en el vacío, nivel tras nivel.',
    'Pilota una nave triangular que rota y propulsa en gravedad cero. Dispara para fragmentar rocas grandes en medianas y pequeñas, sobrevive con 3 vidas y busca el power-up de disparo triple antes de que el campo se llene.',
    'SHOOTER',
    'cover-asteroids',
    'cyan',
    'ASTEROIDS',
    'Destroy asteroids in the void, level after level.',
    'Pilot a triangular ship that rotates and thrusts in zero gravity. Fire to break large rocks into medium and small chunks, survive with 3 lives, and grab the triple-shot power-up before the field fills up.'
  ),
  (
    'crossing',
    'CRUCE',
    'Cruza carriles de tráfico y un río sin perder un solo salto: un golpe y se acabó.',
    'Guía a tu explorador a través de una franja de carriles con vehículos en movimiento y una franja de río con troncos flotantes, saltando de una celda a otra hasta alcanzar una de las cinco metas de la orilla opuesta. Cualquier colisión con un vehículo, o quedarte sin tronco bajo los pies en el río, termina la vida al instante. Llenar las cinco metas sube de nivel y reordena los carriles, más rápidos que antes.',
    'ARCADE',
    'cover-crossing',
    'cyan',
    'CROSSING',
    'Cross traffic lanes and a river without missing a single hop: one hit and it''s over.',
    'Guide your explorer across a strip of lanes with moving vehicles and a river strip with floating logs, hopping from cell to cell to reach one of the five goals on the far shore. Any collision with a vehicle, or being left without a log underfoot in the river, ends the life instantly. Filling all five goals levels up and reshuffles the lanes, faster than before.'
  ),
  (
    'invasion',
    'INVASIÓN',
    'Repele una flota que desciende en formación y acelera con cada oleada.',
    'Controla un cañón de defensa fijo en la base de la pantalla y dispara contra una formación de 40 alienígenas que desciende oleada tras oleada, acelerando a medida que quedan menos enemigos. Tres vidas, sin escudos ni power-ups: la formación y su velocidad creciente son el único desafío.',
    'SHOOTER',
    'cover-invasion',
    'magenta',
    'INVASION',
    'Fend off a fleet descending in formation, speeding up with every wave.',
    'Control a defense cannon fixed at the bottom of the screen and fire at a formation of 40 aliens that descends wave after wave, accelerating as fewer enemies remain. Three lives, no shields or power-ups: the formation and its rising speed are the only challenge.'
  ),
  (
    'snake',
    'SERPIENTE',
    'Guía a la serpiente, come frutas y no choques contigo mismo.',
    'Controla una serpiente que crece con cada fruta que come sobre una cuadrícula de 20 por 20 celdas. Cada tramo de frutas comidas sube de nivel y acelera el movimiento; chocar contra tu propio cuerpo o contra el borde del tablero termina la partida al instante.',
    'ARCADE',
    'cover-snake',
    'green',
    'SNAKE',
    'Guide the snake, eat fruit, and don''t crash into yourself.',
    'Control a snake that grows with every fruit it eats on a 20-by-20 grid. Each batch of fruit eaten levels up and speeds up the movement; crashing into your own body or the edge of the board ends the run instantly.'
  ),
  (
    'tetris',
    'TETRIS',
    'Encaja las piezas, completa líneas y sobrevive a la caída.',
    'Siete tetrominós caen sobre un tablero de 10 por 20 celdas que se acelera nivel tras nivel. Rota, desplaza y suelta cada pieza para completar líneas, encadena combos y busca el TETRIS de cuatro líneas, el T-Spin y el Perfect Clear antes de que la pila llegue arriba.',
    'PUZZLE',
    'cover-tetris',
    'magenta',
    'TETRIS',
    'Fit the pieces together, clear lines, and survive the drop.',
    'Seven tetrominoes fall onto a 10-by-20 board that speeds up level after level. Rotate, shift, and drop each piece to clear lines, chain combos, and go for the four-line Tetris, the T-Spin, and the Perfect Clear before the stack reaches the top.'
  )
on conflict (id) do nothing;
