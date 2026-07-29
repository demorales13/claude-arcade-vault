# Juegos sugeridos

Memoria del agente `game-planner` (`.claude/agents/game-planner.md`). Registra qué juegos se han
evaluado para el catálogo y con qué resultado, para no volver a proponer lo mismo. Los juegos ya
construidos viven en `implemented-games.md`.

Estados: `Propuesto` → `Aceptado` (existe spec) → `Implementado` · o `Rechazado` / `Aplazado`.

| Juego            | Fecha      | Estado    | cat / color                                  | Resumen del veredicto                                                                                                                                                                                   |
| ---------------- | ---------- | --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INVASIÓN         | 2026-07-29 | Propuesto | SHOOTER / magenta                            | Disparo fijo contra una formación de enemigos que desciende y acelera por oleadas; mecánica claramente distinta a Asteroides dentro de la misma categoría. Mejor candidato de esta ronda.               |
| RALLY            | 2026-07-29 | Propuesto | VERSUS / yellow                              | Pong contra una IA, marcador acumulativo de puntos anotados. Única forma razonable de ocupar la categoría VERSUS, vacía hoy — pero su mecánica de rebote en paleta se solapa parcialmente con Arkanoid. |
| CRUCE            | 2026-07-29 | Propuesto | ARCADE / cyan                                | Cruce de carriles con saltos y muerte instantánea, estilo Frogger genérico. Mecánica nueva, pero controles de grid 4-direccional ya usados por Serpiente; ARCADE ya tiene dos entradas.                 |
| DUELO DE TANQUES | 2026-07-29 | Aplazado  | SHOOTER o VERSUS (sin decidir) / sin definir | Combate de tanques estilo Battle City genérico. Motor mucho más grande (IA, paredes destructibles, balas que rebotan) y categoría ambigua — se aplaza por tamaño, no se descarta por encaje.            |

## INVASIÓN (`invasion` propuesto)

- **Fecha / Estado:** 2026-07-29 · Propuesto
- **Fila de catálogo propuesta:**
  - `cat`: `SHOOTER` · `color`: `magenta`
  - `title`: INVASIÓN · `short`: "Repele una flota que desciende en formación y acelera con cada oleada."
  - `long` (borrador): "Controla una nave fija en la base de la pantalla y dispara contra una formación de invasores que desciende oleada tras oleada, acelerando y devolviendo fuego a medida que quedan menos enemigos. Cada oleada eliminada sube el nivel y la velocidad de la siguiente."
  - Portada (concepto): gradiente radial oscuro (violeta/negro) con una cuadrícula regular de siluetas alienígenas pixel-art en magenta, mismo patrón de capas que `.cover-asteroids` pero con formación de grid en vez de campo disperso.
- **Por qué encaja:** dentro de SHOOTER, que hoy sólo tiene la física inercial de Asteroides, aporta un disparo fijo de formación descendente — un esquema de control y de amenaza completamente distinto. El modelo de puntuación (enemigo destruido, oleada completa, nivel) es un entero acumulativo directo, sin fricción con el esquema de `scores`.
- **Criterios:**
  - Encaje temático: Alto — pixel-art de nave/formación alienígena es estética retro/neón directa.
  - Modelo de puntuación: Alto — puntos por enemigo + bonus por oleada, un jugador, entero acumulativo.
  - Viabilidad del motor: Alto — grid de enemigos, colisión AABB, balas jugador/enemigo; canvas 2D puro, sin dependencias. Hay múltiples implementaciones de referencia en JS/canvas vanilla que confirman el puerto.
  - Controles: Alto — mover izquierda/derecha + disparar, tres key codes discretos, mapeo directo a botones táctiles.
  - Diversidad: Alto — mecánica y sensación de control opuestas a Asteroides dentro de la misma categoría; color magenta no repite dentro de SHOOTER (hoy sólo cyan).
  - Riesgo legal: Medio — la mecánica en sí (formación que desciende) no es apropiable, pero el nombre "Space Invaders" es marca viva de Taito; el título y el diseño de enemigos deben ser propios, nunca una copia 1:1 del sprite original.
  - Tamaño: Alto — alcance comparable al de Asteroides, cabe en un spec único sin partir.
- **Riesgos / notas:** no usar el nombre de marca en título ni assets; diseñar el sprite del alienígena desde cero. Es el candidato con menos fricción de las tres opciones presentadas.
- **Veredicto humano:** _(pendiente)_

## RALLY (`rally` propuesto)

- **Fecha / Estado:** 2026-07-29 · Propuesto
- **Fila de catálogo propuesta:**
  - `cat`: `VERSUS` · `color`: `yellow`
  - `title`: RALLY · `short`: "Duelo de paletas contra una IA que sube de nivel con cada punto que anota."
  - `long` (borrador): "Un duelo de paleta y pelota contra un rival controlado por IA que mejora su reacción a medida que el marcador sube. La puntuación es el número de puntos anotados antes de perder tres rallies."
  - Portada (concepto): fondo negro con línea central punteada vertical estilo cancha, paleta cian (jugador) y paleta magenta (IA) en los extremos, pelota amarilla con estela.
- **Por qué encaja:** es la única forma razonable de ocupar `VERSUS`, hoy vacía, sin romper el modelo de `scores`: el "versus" se resuelve como jugador-contra-máquina, con un único entero acumulativo (puntos anotados) en vez de un resultado 1v1 entre dos humanos, que no tendría leaderboard coherente en este esquema.
- **Criterios:**
  - Encaje temático: Alto — estética CRT/retro es literalmente el origen histórico de este tipo de juego.
  - Modelo de puntuación: Medio-Alto — entero acumulativo de un jugador, correcto para `scores`, pero sigue siendo la categoría más forzada del esquema; aquí se resuelve haciendo del rival una IA, no un segundo jugador humano.
  - Viabilidad del motor: Alto — dos paletas, una pelota, física de rebote simple; canvas 2D puro.
  - Controles: Alto — mover paleta arriba/abajo, dos key codes.
  - Diversidad: Media — cubre la categoría VERSUS vacía (alto valor ahí), pero la mecánica de rebote anguloso en paleta ya está cubierta por Arkanoid; es el candidato que menos aporta en mecánica pura de los tres.
  - Riesgo legal: Bajo-Medio — "Pong" es casi genérico en el lenguaje común pese a ser marca histórica de Atari; igual conviene no usarlo como título.
  - Tamaño: Alto — motor pequeño, spec compacto.
- **Riesgos / notas:** el solapamiento mecánico con Arkanoid (rebote en paleta) es la objeción principal — vale la pena decidir conscientemente si el catálogo quiere dos juegos de rebote de paleta o si conviene reservar VERSUS para otra idea más adelante. Sigue siendo, hoy, la única propuesta concreta para esa categoría.
- **Veredicto humano:** _(pendiente)_

## CRUCE (`crossing` propuesto)

- **Fecha / Estado:** 2026-07-29 · Propuesto
- **Fila de catálogo propuesta:**
  - `cat`: `ARCADE` · `color`: `cyan`
  - `title`: CRUCE · `short`: "Guía a tu explorador a través de carriles de tráfico y un río sin que lo arrollen."
  - `long` (borrador): "Cruza una serie de carriles con obstáculos que se mueven a distintas velocidades y una franja de río con plataformas flotantes, sin perder ningún salto. Cada fila cruzada suma puntos; cruzar la pantalla completa otorga un bonus y sube el nivel de velocidad."
  - Portada (concepto): franjas horizontales alternando asfalto oscuro y agua cian, siluetas de vehículos/troncos en movimiento, personaje pixelado cian en el centro.
- **Por qué encaja:** aporta una mecánica de "salto por carriles" con muerte instantánea al contacto, distinta del crecimiento progresivo de Serpiente y del rebote de Arkanoid.
- **Criterios:**
  - Encaje temático: Alto.
  - Modelo de puntuación: Alto — puntos por fila cruzada + bonus por cruce completo, entero acumulativo, un jugador.
  - Viabilidad del motor: Alto — carriles con obstáculos a velocidad constante, canvas 2D simple; hay abundante referencia de implementación en JS/canvas.
  - Controles: Alto — cuatro direcciones discretas de salto, mapeo directo a botones táctiles.
  - Diversidad: Media — mecánica de diseño nueva, pero el esquema de control (grid 4-direccional discreto) repite exactamente el de Serpiente; y ARCADE ya tiene dos entradas (Arkanoid, Serpiente), por lo que esta sería la tercera.
  - Riesgo legal: Medio — la asociación con "Frogger" (marca de Konami) es fuerte en la memoria colectiva; mitigar con tema y personaje propios (nada de rana ni autos clásicos).
  - Tamaño: Alto.
- **Riesgos / notas:** de los tres candidatos presentados es el que menos diversifica el catálogo (categoría ya cubierta dos veces, controles ya usados), por eso queda tercero pese a puntuar bien individualmente.
- **Veredicto humano:** _(pendiente)_

## DUELO DE TANQUES (`tanks` — aplazado, mejor finalista descartado)

- **Fecha / Estado:** 2026-07-29 · Aplazado
- **Resumen:** combate de tanque contra tanque(s) IA en un laberinto con paredes destructibles y balas que rebotan (mecánica genérica de estilo Battle City / Combat, sin nombre de marca).
- **Por qué se aplaza, no se rechaza:** el motor es sustancialmente más grande que el de los otros tres candidatos — requiere IA de movimiento y disparo, paredes destructibles, colisión de balas rebotando y diseño de niveles tipo laberinto — lo que probablemente exigiría partir el spec en varios pasos, algo que el recipe desaconseja para una primera pasada de un juego nuevo. Además hay ambigüedad real de categoría: ¿`SHOOTER` por el disparo o `VERSUS` por el enfrentamiento contra una IA-tanque? Ninguna de las dos lecturas es obviamente correcta, y merece decidirse aparte antes de convertirlo en spec.
- **Veredicto humano:** _(pendiente — candidato a revisitar si se decide invertir en un juego de mayor alcance)_

<!--
Cada sugerencia añade también una sección propia bajo este comentario, con este formato:

## <NOMBRE> (`<id>` propuesto)

- **Fecha / Estado:** AAAA-MM-DD · Propuesto
- **Fila de catálogo propuesta:** `cat` · `color` · `short`
- **Por qué encaja:** …
- **Criterios:** encaje · puntuación · motor · controles · diversidad · legal · tamaño
- **Riesgos / notas:** …
- **Veredicto humano:** _(pendiente)_
-->
