# Juegos sugeridos

Memoria del agente `game-planner` (`.claude/agents/game-planner.md`). Registra qué juegos se han
evaluado para el catálogo y con qué resultado, para no volver a proponer lo mismo. Los juegos ya
construidos viven en `implemented-games.md`.

Estados: `Propuesto` → `Aceptado` (existe spec) → `Implementado` · o `Rechazado` / `Aplazado`.

| Juego            | Fecha      | Estado    | cat / color                                  | Resumen del veredicto                                                                                                                                                                                   |
| ---------------- | ---------- | --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RALLY            | 2026-07-29 | Propuesto | VERSUS / yellow                              | Pong contra una IA, marcador acumulativo de puntos anotados. Única forma razonable de ocupar la categoría VERSUS, vacía hoy — pero su mecánica de rebote en paleta se solapa parcialmente con Arkanoid. |
| DUELO DE TANQUES | 2026-07-29 | Aplazado  | SHOOTER o VERSUS (sin decidir) / sin definir | Combate de tanques estilo Battle City genérico. Motor mucho más grande (IA, paredes destructibles, balas que rebotan) y categoría ambigua — se aplaza por tamaño, no se descarta por encaje.            |

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
