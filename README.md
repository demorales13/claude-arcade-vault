## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

Usa Spec Driven Design — cada feature se define primero en `specs/NN-slug.md` antes de implementarse. Ver `CLAUDE.md` para el flujo (`/spec` y `/spec-impl`).

## Rutas

| Ruta | Pantalla |
| --- | --- |
| `/` | Home / landing |
| `/games` | Biblioteca de juegos |
| `/games/[id]` | Detalle de un juego |
| `/games/[id]/play` | Reproductor (partida simulada) |
| `/login` | Iniciar sesión / crear cuenta |
| `/hall-of-fame` | Salón de la fama |
| `/about` | Acerca de + formulario de contacto |

Sesión y puntuaciones son mock, persistidas en `localStorage`. El envío del formulario de contacto también es simulado (Server Action en `app/actions/contact.ts`); ver `.env.example` para las variables pensadas para una futura integración con Resend.

## Commands

```
npm run dev      # start dev server (Turbopack, next dev)
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint (flat config via eslint.config.mjs)
```

There is no test runner configured yet.