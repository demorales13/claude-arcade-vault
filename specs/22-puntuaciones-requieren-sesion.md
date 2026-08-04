# SPEC 22 — Puntuaciones requieren sesión

> **Status:** Approved
> **Depends on:** 06-leaderboard-catalogo-supabase, 17-autenticacion-email-password, 20-username-unico, 21-seguridad-basica
> **Date:** 2026-08-04
> **Objective:** Cerrar el hallazgo de severidad Medio de `security-audit-log.md` exigiendo una sesión autenticada para insertar en `scores`, atando cada puntuación a su usuario (`user_id`) y a su `profiles.username` en vez de a un texto libre editable por el cliente.

## Por qué este spec existe

`security-audit-log.md` (auditoría del 2026-08-04) registra un hallazgo de severidad **Medio**:
`scores` acepta INSERT público sin autenticación (policy `public insert scores`, rol `public`,
sin `auth.uid()`), validado solo por `CHECK (score >= 0 AND length(trim(player_name)) > 0)`.
Cualquiera con la publishable key puede insertar puntuaciones falsas en cualquier `game_id` sin
haber iniciado sesión.

No es una regresión: `specs/06-leaderboard-catalogo-supabase.md` aceptó esto explícitamente como
deuda técnica "hasta que exista Auth real", y `specs/21-seguridad-basica.md` lo dejó fuera de
alcance por decisión expresa ("solo se documenta que ya existen"). Auth real existe desde specs
17–20, así que la condición que justificaba la deuda ya no se cumple: hoy hay `auth.uid()`
disponible y una tabla `profiles` con username único que nunca se aprovechó para esto. Además, el
`player_name` que llega hoy a `scores` es texto libre editable en el modal de fin de partida —
incluso un usuario autenticado puede guardar bajo el nombre de otro. Este spec cierra ambos
problemas a la vez, porque el segundo es consecuencia directa de resolver el primero.

## Scope

**In:**

- Columna `scores.user_id uuid references auth.users(id)`, con `default auth.uid()` y `not null`.
- Migración de datos de las 28 filas existentes: reatribuir por `username` las que coincidan,
  borrar el resto (verificado: solo 1 de 28 filas es atribuible a un usuario real hoy).
- Nueva policy de INSERT en `scores`, solo para `authenticated`, que exige `auth.uid() = user_id`
  y que `player_name` coincida con `profiles.username` del usuario autenticado (cierra también la
  suplantación de nombre, no solo el anonimato).
- `components/game-over-modal.tsx`: sin sesión, no se ofrece guardar — se muestra un mensaje y un
  enlace a `/login`; con sesión, el nombre se lee de `profiles.username` (ya no es un `<input>`
  editable) y se añaden estados de guardado en curso y de error visible.
- Los 7 puntos de guardado (`components/game-player.tsx` y los 6
  `components/games/*-player.tsx`) dejan de tragarse el error de `insertScore` con
  `console.error` — el error sube al modal para mostrarse.
- Claves ES/EN nuevas en `lib/i18n/translations.ts` para los strings nuevos del modal.
- Actualizar `security-audit-log.md`: hallazgo Medio pasa a `En spec` → `Resuelto` una vez
  implementado.
- Actualizar la nota de `CLAUDE.md` ("el siguiente número libre es 22" → 23).

**Out of scope (para otro spec):**

- Rate limiting, captcha o cualquier verificación de score plausible más allá del `CHECK` ya
  existente — seguía fuera de alcance en spec 06 y sigue igual aquí.
- Traducir el resto de `game-over-modal.tsx` (hoy hardcodeado en español) — solo se traducen los
  strings nuevos que introduce este spec.
- Cambiar `lib/data/scores.ts` — su firma no cambia; el `user_id` lo rellena el `default
auth.uid()` del motor, no el cliente.
- Mover el INSERT a una Server Action — se mantiene en el cliente, con RLS como único gate, igual
  que hoy.
- Cualquier UI para que un usuario vea o borre su propio historial de puntuaciones.
- Backfill o recuperación de las 27 filas que se borran en este spec — se documenta como pérdida
  aceptada, no como algo a mitigar aquí.

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
-- 1. Columna de propiedad (nullable primero, para poder rellenarla)
alter table scores add column user_id uuid references auth.users(id) on delete cascade;

-- 2. Verificar antes de borrar (paso de solo lectura)
select s.id, s.player_name, s.score, s.created_at
from scores s
where not exists (select 1 from profiles p where p.username = s.player_name);

-- 3. Reatribuir las filas cuyo player_name coincide con un username real
update scores s set user_id = p.id
from profiles p
where p.username = s.player_name;

-- 4. Borrar el resto (no atribuibles a ningún usuario real)
delete from scores where user_id is null;

-- 5. Ahora la columna puede ser obligatoria, con default automático
alter table scores alter column user_id set not null;
alter table scores alter column user_id set default auth.uid();

-- 6. Reemplazar la policy de INSERT abierta
drop policy "public insert scores" on scores;

create policy "authenticated insert own scores" on scores
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and score >= 0
    and player_name = (select username from profiles where id = auth.uid())
  );
```

`public read scores` (SELECT) no cambia — el leaderboard sigue siendo público. `games_with_stats`
(la vista que agrega `best`/`plays`) no se modifica; sus números bajan como efecto secundario del
paso 4, y eso se documenta en Decisions y Risks, no se compensa.

## Implementation plan

1. **Migración SQL (bloque completo de arriba).** Ejecutar en el SQL Editor de Supabase —
   **paso manual del usuario**, en orden, verificando el resultado del `select` del paso 2 antes
   de correr el `delete` del paso 4.
   _Test manual:_ `select count(*) from scores where user_id is null;` devuelve `0`; un INSERT de
   prueba sin sesión (rol `anon`) contra `scores` es rechazado por RLS.

2. **Estados nuevos en `game-over-modal.tsx`.** Añadir lectura de sesión
   (`supabase.auth.getUser()`) y, si hay usuario, de su `profiles.username`; añadir estado
   `pending` (botón deshabilitado mientras se guarda) y `error` (mensaje visible si `onSave`
   rechaza). El prop `onSave` cambia de `() => void` a `(playerName: string) => Promise<void>`;
   se elimina `onNameChange`.
   _Test:_ `npm run build` compila; el modal no se usa todavía con los nuevos props en ningún
   reproductor.

3. **Rama sin sesión vs. con sesión en el modal.** Sin usuario autenticado: no se renderiza el
   `<input>` ni el botón "GUARDAR PUNTUACIÓN" — en su lugar, texto + `<Link href="/login">`. Con
   usuario autenticado pero sin `profiles.username` todavía (no debería ocurrir tras spec 20, pero
   es defensivo): mensaje de error explícito, no un guardado silencioso fallido. Con usuario y
   username: mostrar el username (no editable) y el botón, deshabilitado mientras `pending`.
   _Test manual:_ jugar como invitado y terminar partida muestra el enlace a iniciar sesión, sin
   input ni botón de guardar.

4. **Conectar los 7 puntos de guardado.** En `components/game-player.tsx` y los 6
   `components/games/*-player.tsx`, cambiar la llamada a `insertScore` para que ocurra dentro de
   la nueva firma de `onSave` y dejar que la excepción suba (quitar el `try/catch` que hacía
   `console.error`); el modal la captura y la muestra vía el estado `error` del paso 2.
   _Test manual:_ con sesión iniciada, terminar una partida en cada uno de los 7 flujos y guardar
   puntuación funciona igual que antes; forzando un error de red se ve el mensaje en el modal en
   vez de fallar en silencio.

5. **Claves de traducción.** Añadir a `lib/i18n/translations.ts` (ES/EN):
   `guestCannotSave`, `signInToSave`, `saveError`, `saving`.
   _Test:_ alternar ES/EN en el modal de fin de partida muestra los strings nuevos traducidos, sin
   claves faltantes.

6. **Actualizar `security-audit-log.md`.** Cambiar el hallazgo Medio de `Aceptado` a
   `Resuelto`, referenciando este spec.
   _Test:_ lectura manual, sin impacto en build.

7. **Actualizar `CLAUDE.md`.** Corregir "el siguiente número libre es 22" → 23.
   _Test:_ lectura manual, sin impacto en build.

## Acceptance criteria

- [ ] `npm run build` compila sin errores tras cada paso del plan.
- [ ] `select count(*) from scores where user_id is null;` devuelve `0` tras el paso 1.
- [ ] Un INSERT anónimo (rol `anon`, sin sesión) contra `scores` es rechazado por RLS.
- [ ] Un usuario autenticado puede guardar su puntuación y la fila resultante tiene
      `user_id = auth.uid()`.
- [ ] Un INSERT autenticado con `player_name` distinto al `username` del usuario es rechazado por
      RLS.
- [ ] Como invitado (`playAsGuest()`), el modal de fin de partida no muestra input ni botón de
      guardar, y sí un enlace a `/login`.
- [ ] Como usuario con sesión, el modal muestra su `username` (no editable) y, al guardar, pasa a
      "PUNTUACIÓN GUARDADA" igual que hoy.
- [ ] Forzar un fallo del INSERT (ej. sesión expirada) muestra un mensaje de error visible en el
      modal, no un fallo silencioso en consola.
- [ ] `/games` y `/hall-of-fame` siguen renderizando correctamente con los totales reducidos tras
      el borrado del paso 1.
- [ ] `security-audit-log.md` refleja el hallazgo Medio como `Resuelto`.
- [ ] `CLAUDE.md` ya no dice que el siguiente número libre es 22.
- [ ] Ninguno de los flujos de login/registro/reset/OAuth de specs 17–19 cambia de comportamiento.

## Decisions

- **Sí:** invitados pueden seguir jugando, pero no guardar puntuación — se conserva
  `playAsGuest()` tal cual; el modal simplemente no ofrece guardar sin sesión. Menor fricción que
  eliminar el modo invitado, y coherente con que el leaderboard ya es de lectura pública.
- **Sí:** se añade `scores.user_id` con `default auth.uid()` en vez de exigir que el cliente lo
  mande — así `lib/data/scores.ts` no cambia de firma y el motor es la única fuente de verdad del
  autor de la fila.
- **Sí:** la policy también exige `player_name = profiles.username`, no solo `auth.uid() =
user_id` — de lo contrario un usuario autenticado seguiría pudiendo suplantar el nombre de otro
  jugador en el leaderboard, que es un problema de integridad tan real como el anonimato.
- **Sí:** se borran las 27 filas no atribuibles a un usuario real (`DEMORALES` × 18, `INVITADO` × 9) en vez de conservarlas con `user_id NULL` — decisión explícita del usuario; simplifica el
  esquema (`user_id not null`) a costa de perder ese historial.
- **No:** mover el INSERT a una Server Action — RLS ya es el gate real (como en toda la app desde
  spec 04); añadir una capa de servidor no cambia la garantía de seguridad, solo la complejidad.
- **No:** rate limiting o verificación de score plausible — deuda ya aceptada en spec 06, sin
  relación con el problema de autenticación que cierra este spec.

## Risks

| Riesgo                                                                                                                             | Mitigación                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Borrar 27 de 28 filas de `scores` reduce a casi cero los `best`/`plays` visibles en `/games` y `/hall-of-fame`.                    | Consecuencia aceptada y decidida explícitamente por el usuario; documentada aquí para que no sea una sorpresa post-deploy.  |
| Un usuario autenticado sin fila en `profiles` (posible si abandona el flujo de spec 20 antes de elegir username) no puede guardar. | El modal debe mostrar un error explícito en ese caso (paso 3 del plan), no fallar en silencio ni romper el resto del flujo. |
| `on delete cascade` en `user_id`: borrar una cuenta borra también sus puntuaciones históricas.                                     | Decisión explícita y documentada arriba; coherente con que las puntuaciones no tienen sentido sin su dueño tras este spec.  |
| El `update`/`delete` del paso 1 es irreversible si se ejecuta sin revisar el `select` previo.                                      | El paso 1 obliga explícitamente a correr y revisar el `select` de verificación antes del `delete`.                          |

## Lo que **no** está en este spec

- Rate limiting, captcha o verificación de score plausible en el INSERT.
- Traducción completa de `game-over-modal.tsx` a EN — solo los strings nuevos.
- Cambios a `lib/data/scores.ts` o mover el INSERT a una Server Action.
- UI para que un usuario consulte o borre su propio historial de puntuaciones.
- Recuperación de las filas borradas en la migración de datos.

Cada uno de estos, si se implementa, va en su propio spec.
