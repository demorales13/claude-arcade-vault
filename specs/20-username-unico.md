# SPEC 20 — Username único

> **Status:** Approved
> **Depends on:** 17-autenticacion-email-password, 19-auth-oauth-social
> **Date:** 2026-08-04
> **Objective:** Impedir que dos cuentas compartan el mismo nombre de jugador, garantizándolo con una restricción de base de datos en vez de solo en el cliente.

## Por qué este spec existe

Hoy es posible registrarse con Google y con GitHub usando el mismo nombre de usuario, y el sitio lo permite: en la base de datos real del proyecto hay dos filas en `auth.users` con `raw_user_meta_data.display_name = 'DEMORALES13'` (una por Google, otra por GitHub).

La causa es de diseño: specs 17 y 19 decidieron explícitamente no crear una tabla de perfiles y guardar el nombre solo en `auth.users.user_metadata.display_name`, un JSONB por usuario sobre el que Postgres no puede imponer unicidad. Ni `components/choose-username-form.tsx` ni `components/auth-form.tsx` comprueban disponibilidad antes de escribir — llaman directo a `supabase.auth.updateUser` / `supabase.auth.signUp`.

De paso, el mismo código tiene dos bugs menores que este spec corrige porque toca los mismos archivos: `normalizeName` está duplicado con comportamiento distinto en `auth-form.tsx` (fallback silencioso a `"PLAYER1"` si el campo está vacío) y en `choose-username-form.tsx` (sin fallback), y ninguno de los dos hace `trim()` antes de normalizar.

## Scope

**In:**

- Tabla nueva `public.profiles` (`id` referenciando `auth.users`, `username`, `created_at`) con un índice único case-insensitive sobre el username.
- Backfill de los usuarios existentes hacia `profiles`, resolviendo el duplicado actual: gana la cuenta más antigua por `created_at` (la de Google, `DEMORALES13`); a la cuenta más reciente (GitHub) se le borra `display_name` de sus metadatos para que vuelva a pasar por onboarding.
- Helper compartido `lib/username.ts` (`normalizeUsername`, `isValidUsername`) que reemplaza las dos copias divergentes de `normalizeName`.
- Server Action `app/actions/username.ts` (`claimUsername`): único punto que inserta en `profiles` y decide si un nombre está disponible, vía la restricción única de la base de datos (sin `select` previo).
- `/choose-username` pasa a ser el único lugar del sitio donde se reclama un username — para los tres proveedores (Google, GitHub, email/contraseña). `components/choose-username-form.tsx` llama a `claimUsername` en vez de `updateUser` directo, y muestra un error específico cuando el nombre ya está en uso.
- `components/auth-form.tsx`: se quita el campo "Nombre de usuario" de la pestaña CREAR CUENTA; `signUp` queda solo con email y contraseña.
- `app/auth/confirm/route.ts`: tras confirmar el correo de un registro nuevo, si el usuario no tiene `user_metadata.display_name`, redirige a `/choose-username` en vez de `/` — misma señal que ya usa `app/auth/callback/route.ts` para OAuth.
- Nuevas claves de traducción (ES/EN) para "nombre no disponible" y "nombre inválido".
- Corrección de la nota stale en `CLAUDE.md` ("el siguiente número libre es 17" → ya existen 17, 18, 19).

**Out of scope (para otro spec):**

- Comprobación de disponibilidad en vivo mientras se escribe (debounce + consulta). El intento de insertar basta como validación.
- Pantalla para cambiar el username después de elegirlo — sigue sin existir una página de perfil, igual que en specs 17/18/19.
- Ligar `scores.player_name` a `profiles.id` con una foreign key — sigue siendo texto libre; deuda ya registrada en `specs/06-leaderboard-catalogo-supabase.md`.
- Guard global en `proxy.ts` que fuerce el onboarding en cualquier ruta visitada — se mantiene la señal existente en los route handlers de callback/confirm.
- Vincular cuentas OAuth y de email/contraseña que comparten el mismo correo — riesgo ya declarado y no resuelto en `specs/19-auth-oauth-social.md`.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx` o `hall-of-fame-board.tsx`.

## Data model

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Z0-9_]{3,12}$'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on profiles (lower(username));

alter table profiles enable row level security;
create policy "public read profiles" on profiles for select using (true);
create policy "own insert profile" on profiles for insert to authenticated
  with check (auth.uid() = id);
create policy "own update profile" on profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
```

El índice único va sobre `lower(username)` para dar unicidad case-insensitive sin depender de la extensión `citext`. El `check` traslada a la base de datos la convención que hoy solo vive en JS (mayúsculas, máx. 12 caracteres) y añade un mínimo de 3 caracteres y un charset explícito.

Backfill y resolución del duplicado actual (mismo bloque SQL, ejecutado una sola vez):

```sql
insert into profiles (id, username, created_at)
select distinct on (upper(raw_user_meta_data ->> 'display_name'))
       id, upper(raw_user_meta_data ->> 'display_name'), created_at
from auth.users
where coalesce(raw_user_meta_data ->> 'display_name', '') <> ''
order by upper(raw_user_meta_data ->> 'display_name'), created_at asc;

update auth.users u
set raw_user_meta_data = u.raw_user_meta_data - 'display_name'
where not exists (select 1 from profiles p where p.id = u.id);
```

```ts
// lib/username.ts
function normalizeUsername(raw: string): string; // trim + mayúsculas + máx. 12
function isValidUsername(name: string): boolean; // /^[A-Z0-9_]{3,12}$/

// app/actions/username.ts
type ClaimUsernameResult =
  { ok: true } | { ok: false; error: "invalid" | "taken" | "unauthenticated" };
async function claimUsername(raw: string): Promise<ClaimUsernameResult>;
```

Convenciones:

- `av_user` en `localStorage` no cambia de forma (`{ name: string, email?: string, avatar?: string } | null`, según lo construido en specs 17/19); sigue leyendo `user_metadata.display_name`, que `claimUsername` actualiza al final tras el `insert` en `profiles`.
- `profiles.id` es 1:1 con `auth.users.id`; no hay tabla puente ni columna adicional además de `username` y `created_at`.

## Implementation plan

1. **Esquema en Supabase.** Ejecutar en el SQL Editor el bloque `create table profiles` + índice único + RLS de la sección Data model.
   _Test:_ `select * from profiles;` devuelve 0 filas sin error; las policies aparecen en el dashboard.

2. **Backfill y resolución del duplicado.** Ejecutar el bloque `insert into profiles ... / update auth.users ...` de la sección Data model.
   _Test:_ `select count(*) from profiles;` devuelve 1 fila con `username = 'DEMORALES13'` y el `id` de la cuenta de Google; la cuenta de GitHub ya no tiene `display_name` en sus metadatos.

3. **Helper `lib/username.ts`.** Crear `normalizeUsername` e `isValidUsername`.
   _Test:_ `npm run build` compila; no se usa todavía en ningún componente.

4. **Server Action `app/actions/username.ts`.** Implementar `claimUsername`: normaliza, valida formato, obtiene el usuario con el cliente de servidor, hace `insert into profiles`, mapea `23505` (unique violation) a `{ ok: false, error: "taken" }`, y en éxito llama a `supabase.auth.updateUser({ data: { display_name } })`.
   _Test:_ `npm run build` compila; sin UI conectada todavía.

5. **Conectar `choose-username-form.tsx`.** Reemplazar la llamada a `supabase.auth.updateUser` por `claimUsername`; mostrar `dict.auth.errorUsernameTaken` o `dict.auth.errorUsernameInvalid` según el error devuelto.
   _Test manual:_ elegir `DEMORALES13` con la cuenta de GitHub muestra el error de "nombre en uso" y no redirige; elegir un nombre distinto redirige a `/` y lo guarda.

6. **Quitar el campo username de `auth-form.tsx`.** Eliminar el input "Nombre de usuario" de la pestaña CREAR CUENTA y el `normalizeName` local; `signUp` pasa a llamarse solo con `email` y `password`.
   _Test:_ `npm run build` compila; registrar una cuenta nueva por email ya no pide nombre en este paso.

7. **Redirigir a onboarding tras confirmar email.** En `app/auth/confirm/route.ts`, cuando `type !== "recovery"`, comprobar `data.user?.user_metadata?.display_name`; si falta, redirigir a `/choose-username` en vez de `/`.
   _Test manual:_ registrar una cuenta nueva por email, confirmar el enlace del correo, verificar que cae en `/choose-username` y no en `/`.

8. **Traducciones.** Agregar `errorUsernameTaken` y `errorUsernameInvalid` a `dict.auth` en ES y EN.
   _Test:_ alternar ES/EN en `/choose-username` sin claves faltantes ni errores de consola.

9. **Actualizar `CLAUDE.md`.** Corregir "el siguiente número libre es 17" por "el siguiente número libre es 21" (specs 17–20 ya existen tras este spec).
   _Test:_ lectura manual, sin impacto en build.

## Acceptance criteria

- [ ] `npm run build` compila sin errores tras cada paso del plan.
- [ ] `select lower(username), count(*) from profiles group by 1 having count(*) > 1;` devuelve 0 filas.
- [ ] Iniciar sesión con la cuenta de GitHub (que perdió su `display_name` en el backfill) redirige a `/choose-username`.
- [ ] En `/choose-username`, escribir `DEMORALES13` (ya tomado por la cuenta de Google) muestra un error traducido y no redirige ni llama a `updateUser`.
- [ ] En `/choose-username`, escribir un nombre disponible inserta en `profiles`, redirige a `/` y `nav.tsx` muestra ese nombre.
- [ ] Un intento de `insert` directo contra `profiles` con un username ya tomado (por ejemplo desde la consola del navegador) es rechazado por el índice único, no solo por la validación de la UI.
- [ ] La pestaña CREAR CUENTA de `/login` ya no muestra el campo "Nombre de usuario"; el registro solo pide correo y contraseña.
- [ ] Registrar una cuenta nueva por email, confirmar el enlace del correo, y verificar que cae en `/choose-username` en vez de `/`.
- [ ] El flujo de login OAuth de una cuenta ya onboardeada (con fila en `profiles`) sigue entrando directo a `/`, sin pasar por `/choose-username`.
- [ ] El flujo de recuperación de contraseña de spec 18 sigue funcionando sin cambios de comportamiento.
- [ ] Alternar ES/EN en `/choose-username` muestra los nuevos textos de error traducidos.
- [ ] Ninguno de los 7 reproductores de juego, `game-player.tsx` ni `hall-of-fame-board.tsx` cambia de código en este spec.

## Decisions

- **Sí:** tabla `profiles` nueva con índice único sobre `lower(username)`, en vez de seguir guardando el nombre solo en `user_metadata`. Es la única forma de que Postgres, no el cliente, impida el duplicado.
- **Sí:** unicidad vía `unique index` sobre `lower(username)` en vez de la extensión `citext`. Mismo resultado, sin depender de habilitar una extensión.
- **Sí:** el `insert` en `profiles` es el propio mecanismo de validación de disponibilidad — sin `select` previo. Un `select` antes de insertar deja una ventana de carrera (TOCTOU) entre dos registros simultáneos con el mismo nombre; capturar el código de error `23505` de Postgres es atómico.
- **Sí:** `/choose-username` pasa a ser el único punto donde se reclama un username, también para el registro por email. Antes, `auth-form.tsx` escribía el nombre en `signUp` **antes** de que exista sesión activa, momento en el que no se puede insertar en `profiles` bajo RLS sin una service-role key — mover la captura del nombre a después de la confirmación de correo evita ese problema y unifica el flujo con OAuth.
- **Sí:** resolver el duplicado existente conservando la cuenta más antigua (Google) y forzando a la más reciente (GitHub) a repetir el onboarding, en vez de borrar ninguna cuenta. No hay pérdida de datos de usuario, solo se le vuelve a pedir el nombre.
- **Sí:** helper compartido `lib/username.ts` para reemplazar las dos copias divergentes de `normalizeName`, y aplicar `trim()` en la normalización — hoy `"  kai"` se guardaba como `"  KAI"` sin recortar el espacio inicial.
- **No:** verificación de disponibilidad en vivo (debounce mientras se escribe). Añade una llamada de red extra y una ventana de carrera propia sin necesidad — el intento de `insert` en el submit ya es suficiente y atómico.
- **No:** ligar `scores.player_name` a `profiles` con una foreign key. Cambiaría el modelo de puntuaciones de specs 06/07+ (texto libre) y no fue pedido; sigue como deuda técnica documentada.
- **No:** guard global en `proxy.ts` para forzar el onboarding en cualquier ruta. Las dos señales ya existentes (`app/auth/callback/route.ts`, `app/auth/confirm/route.ts`) cubren los puntos de entrada reales sin añadir overhead a cada request.

## Risks

| Riesgo                                                                                                                                                                                                                                                               | Mitigación                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El backfill (paso 2) es SQL manual de un solo uso contra datos de producción; ejecutarlo dos veces podría duplicar filas o fallar por violar el índice único.                                                                                                        | El plan documenta el bloque como ejecución única; el segundo `insert` fallaría de forma segura por el propio índice único (no corrompe datos), pero conviene confirmarlo antes de cerrar el paso.      |
| Un usuario con una cuenta OAuth vieja, ya con `display_name` pero sin fila en `profiles` (si el backfill se hiciera en un momento distinto al de este spec), quedaría con nombre pero sin registro en `profiles`, invisible para la comprobación de unicidad futura. | El backfill del paso 2 cubre a todos los usuarios existentes en el momento de ejecutarlo; cualquier cuenta creada después de ese punto pasa siempre por `claimUsername`, que sí escribe en `profiles`. |
| Mover el registro por email a pedir el nombre en `/choose-username` (paso 7) cambia el orden percibido del flujo de registro respecto a specs 17/19 (antes se pedía en el mismo formulario).                                                                         | Es un cambio de UX intencional de este spec, documentado en Scope y Decisions; el criterio de aceptación correspondiente lo verifica explícitamente antes de cerrar el spec.                           |

## Lo que **no** está en este spec

- Comprobación de disponibilidad en vivo mientras se escribe el nombre.
- Pantalla para cambiar el username después de elegirlo.
- Foreign key entre `scores.player_name` y `profiles`.
- Guard global de onboarding en `proxy.ts`.
- Vinculación de cuentas OAuth y de email/contraseña que comparten correo.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx` o `hall-of-fame-board.tsx`.

Cada uno de estos, si se implementa, va en su propio spec.
