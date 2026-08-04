# SPEC 23 — Migración a un proyecto Supabase de producción

> **Status:** Draft
> **Depends on:** SPEC 04, SPEC 06, SPEC 11, SPEC 17, SPEC 20, SPEC 21, SPEC 22
> **Date:** 2026-08-04
> **Objective:** Llevar el esquema, las políticas y el catálogo de juegos del proyecto Supabase de desarrollo a un proyecto Supabase de producción nuevo y vacío.

## Por qué existe este spec

Hasta ahora ha existido un único proyecto Supabase (desarrollo), al que Claude Code accede por MCP. Se ha creado un segundo proyecto para producción, y la decisión es que **Claude Code no tenga ningún acceso a él** — ni por MCP, ni leyendo su URL o sus claves. Este spec documenta el runbook que ejecuta un humano a mano, y dejó como entregable un conjunto de scripts SQL fieles al estado real de desarrollo, verificado por consulta directa (no reconstruido a partir de los fragmentos de specs anteriores, que están desfasados entre sí: `specs/06` no incluye las columnas `_en` de `specs/11` ni la columna `user_id` de `specs/22`).

Es una migración de infraestructura, no de producto — no cambia ninguna pantalla ni comportamiento de la app.

## Scope

**In:**

- Tres scripts SQL en `db/prod/` (`01-baseline.sql`, `02-seed-games.sql`, `03-verificacion.sql`) para pegar en el SQL Editor de producción.
- El runbook de configuración de Auth que no vive en SQL (Site URL, Redirect URLs, confirmación de email, SMTP, leaked password protection).
- Las variables de entorno que hay que dar de alta en Vercel para el entorno de producción.
- Verificación end-to-end tras la migración.

**Out of scope (para futuros specs):**

- Migrar los usuarios (`auth.users`), perfiles o puntuaciones de prueba existentes en dev — producción arranca con leaderboard e inscripciones vacíos.
- Adoptar el Supabase CLI / `supabase/migrations/` — se mantiene la decisión de `specs/04` y `specs/06` de trabajar sin él.
- Automatizar este runbook (CI/CD que aplique migraciones a producción) — hoy es un procedimiento manual de una sola vez.
- Dar de alta el proveedor SMTP concreto (Resend u otro) — se señala como bloqueante pero su contratación es una tarea aparte.

## Data model

Este spec no introduce estructuras nuevas. Reproduce en producción, tal cual existen hoy en dev, las tablas `games`, `scores`, `profiles` y la vista `games_with_stats` (specs 06, 11, 20, 22).

## Plan de ejecución

1. **Base de datos.** En el SQL Editor del proyecto de producción, pegar y ejecutar en orden: `db/prod/01-baseline.sql` (esquema, índices, RLS, grants), luego `db/prod/02-seed-games.sql` (las 6 filas del catálogo). Ambos son idempotentes: se pueden re-ejecutar sin duplicar ni fallar.
2. **Verificación de base de datos.** Ejecutar `db/prod/03-verificacion.sql` y comparar contra lo esperado (sección siguiente).
3. **Auth — configuración manual en el dashboard de producción** (nada de esto viaja en SQL):
   - **Confirm email:** `ON`. Lo exigen los handlers `app/auth/confirm/route.ts` y `app/auth/callback/route.ts` (spec 17).
   - **Site URL:** el dominio de producción en Vercel.
   - **Redirect URLs:** ese mismo dominio, más el patrón de previews de Vercel si se quiere probar desde ahí. `http://localhost:3000` **no** debe añadirse en producción — ese es el redirect de dev.
   - **SMTP propio — bloqueante:** el servicio de email integrado de Supabase está limitado a unos pocos correos por hora y solo entrega a miembros del equipo del proyecto. Con "Confirm email" activo y sin SMTP propio, **ningún usuario externo puede completar el registro**. Hay que dar de alta un proveedor (`.env.example` ya trae las variables con forma de Resend: `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`) antes de anunciar producción como usable.
   - **Leaked Password Protection:** intentar activarlo. En dev quedó como advisor abierto porque el plan gratuito no lo ofrece (spec 21); si el plan de producción lo permite, activarlo cierra ese WARN.
   - Confirmar que los rate limits por defecto de signup/signin son aceptables.
4. **Variables de entorno en Vercel.** El código solo lee dos nombres (`lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. En el proyecto de Vercel:
   - Scope **Production** → valores del proyecto Supabase de **producción**.
   - Scope **Preview** / **Development** → valores del proyecto Supabase de **dev** (el mismo que usa Claude Code hoy).
5. **Verificación end-to-end** — ver sección de Acceptance criteria.

## Acceptance criteria

- [ ] `db/prod/01-baseline.sql` se ejecuta en producción sin errores.
- [ ] `db/prod/02-seed-games.sql` inserta exactamente 6 filas en `games` (`arkanoid`, `asteroids`, `crossing`, `invasion`, `snake`, `tetris`).
- [ ] `db/prod/03-verificacion.sql` devuelve: 6 juegos, 0 scores, 6 políticas RLS, `security_invoker=true` en `games_with_stats`, y los 5 índices esperados (`games_pkey`, `profiles_pkey`, `profiles_username_key`, `scores_pkey`, `scores_game_id_score_idx`).
- [ ] El advisor de seguridad del proyecto de producción no muestra hallazgos nuevos respecto a dev (como mucho, el mismo WARN de leaked password si el plan no lo permite activar).
- [ ] Con las variables de entorno de producción en local, `npm run dev` muestra en `/games` los 6 juegos con `best = 0` y `plays = 0`, y `/hall-of-fame` carga sin error mostrando "sin puntuaciones".
- [ ] Un registro real (signup) contra el dominio de producción completa el flujo de confirmación por email.
- [ ] Ese usuario puede elegir username en `/choose-username`, jugar una partida completa y guardar su puntuación — visible después en `/hall-of-fame` y en el detalle del juego.
- [ ] Las variables de entorno en Vercel están separadas por scope: producción apunta al proyecto Supabase de producción; preview/development siguen apuntando a dev.

## Decisiones

- **Sí:** transcribir el esquema verificado por consulta directa a dev, no reconstruirlo concatenando specs. Los specs individuales quedaron desfasados entre sí (ver "Por qué existe este spec").
- **No:** migrar `auth.users`, `profiles` ni `scores` de dev. Son datos de prueba; arrastrarlos exigiría copiar hashes de contraseñas del esquema `auth` con una connection string de producción que Claude Code no debe tener.
- **Sí:** mantener el flujo sin Supabase CLI (`specs/04`, `specs/06`). Scripts `.sql` versionados en `db/prod/` en su lugar, pegados a mano en el SQL Editor.
- **No:** automatizar este runbook con CI/CD. Es una migración de una sola vez; automatizarla es sobre-ingeniería hasta que haya una segunda migración real que lo justifique.
- **Sí:** documentar el bloqueo de SMTP como parte de este spec en vez de asumir que "activar Confirm email" basta. Sin SMTP propio, el registro en producción falla silenciosamente para cualquiera fuera del equipo del proyecto.

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El plan de producción no permite activar Leaked Password Protection                      | Se documenta como advisor WARN aceptado, igual que en dev (spec 21); no bloquea el resto del runbook.                                                                                                                                                                             |
| Se pega `02-seed-games.sql` antes que `01-baseline.sql`                                  | El `insert` fallará por falta de la tabla `games`; el orden numerado de los archivos y el paso 1 del plan lo dejan explícito.                                                                                                                                                     |
| Alguien añade un juego nuevo a dev y se olvida de actualizar `db/prod/02-seed-games.sql` | `db/prod/01-baseline.sql` pasa a ser la referencia canónica del esquema (ver nota añadida en `CLAUDE.md`); cada spec que agregue DDL debe actualizarlo. El seed de juegos es una foto puntual del catálogo en la fecha de este spec, no se mantiene sincronizado automáticamente. |

## Qué queda **fuera** de este spec

- Usuarios, perfiles y puntuaciones de prueba de dev — no se migran.
- Adopción del Supabase CLI.
- Automatización del runbook.
- Contratación del proveedor SMTP concreto (solo se señala como bloqueante).

Cada uno de estos, si se necesita, va en su propio spec.
