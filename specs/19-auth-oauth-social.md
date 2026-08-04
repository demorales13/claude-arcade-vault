# SPEC 19 — Login con Google y GitHub (OAuth)

> **Status:** Approved
> **Depends on:** 17-autenticacion-email-password
> **Date:** 2026-08-03
> **Objective:** Activar los botones GOOGLE/GITHUB ya presentes (pero ocultos desde spec 17) en `components/auth-form.tsx`, con un nuevo callback OAuth y una pantalla de onboarding obligatoria (`/choose-username`) para capturar el nombre de jugador en el primer login social.

## Scope

**In:**

- Botones GOOGLE/GITHUB y su divisor "O CONTINÚA CON" en `components/auth-form.tsx`, visibles en ambas pestañas (INICIAR SESIÓN y CREAR CUENTA), ya no ocultos como en spec 17. `onClick` llama a `supabase.auth.signInWithOAuth({ provider: "google" | "github", options: { redirectTo: `${origin}/auth/callback` } })`.
- Route Handler `app/auth/callback/route.ts`: recibe el `code` que Supabase agrega al volver del proveedor, llama a `supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor. Si el usuario resultante no tiene `user_metadata.display_name`, redirige a `/choose-username`; si ya lo tiene (login OAuth de un usuario que ya pasó por onboarding antes), redirige a `/`.
- Página `app/choose-username/page.tsx`: formulario con un solo campo (Nombre de usuario), obligatorio, normalizado igual que en spec 17 (mayúsculas, máx. 12 caracteres). Al enviar, llama a `supabase.auth.updateUser({ data: { display_name } })` y redirige a `/`. Sin botón de omitir. Si se visita sin sesión activa, redirige a `/login`.
- Extensión de `components/nav.tsx` (construido en spec 17): su listener `onAuthStateChange` ahora también reacciona a `USER_UPDATED` (disparado cuando `/choose-username` guarda el nombre) para sincronizar `av_user` en ese momento; además, en `SIGNED_IN`, si `user_metadata.display_name` todavía no existe (primer login OAuth antes de pasar por onboarding), **no** escribe nada en `av_user` — evita guardar un nombre vacío/indefinido mientras el usuario está en camino a `/choose-username`.
- Nuevas claves en `dict.auth` (ES y EN) para `/choose-username` (título, campo, botón, error de nombre vacío).
- Paso manual (usuario), documentado explícitamente como prerrequisito: crear un OAuth Client de Google (Google Cloud Console) y una OAuth App de GitHub, ambos con el callback URL que da Supabase (`https://<project>.supabase.co/auth/v1/callback`), y cargar sus Client ID/Secret en el dashboard de Supabase (Authentication → Providers). Sin este paso, los botones existen pero Supabase rechaza el intento de OAuth.

**Out of scope (para otro spec):**

- Cualquier proveedor OAuth adicional (Discord, Twitter/X, etc.) — solo Google y GitHub, como se pidió.
- Editar el nombre de jugador después del onboarding inicial — sigue sin existir una pantalla de perfil, igual que en specs 17/18.
- Vincular manualmente una cuenta OAuth con una cuenta email/contraseña ya existente del mismo correo — se deja el comportamiento por defecto de Supabase para identidades duplicadas, documentado como riesgo, no resuelto con UI propia.
- Recuperación de contraseña — ya cubierta en `specs/18-auth-reset-password.md`, sin relación con OAuth.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx` o `hall-of-fame-board.tsx`.

## Data model

Este spec no crea tablas nuevas. Reutiliza `auth.users`/`user_metadata` ya definidos en spec 17; el único campo relevante es el mismo `display_name` que ya usa el flujo de email/contraseña:

```ts
// user_metadata tras completar /choose-username
type OAuthMetadata = {
  display_name: string; // igual normalización que en spec 17: mayúsculas, máx. 12 caracteres
};

// app/auth/callback/route.ts
// GET ?code=... — supabase.auth.exchangeCodeForSession(code)
// sin user_metadata.display_name → redirige a "/choose-username"
// con user_metadata.display_name → redirige a "/"

// app/choose-username/page.tsx — estado local del formulario, no persistido
type ChooseUsernameForm = {
  username: string;
};
```

Convenciones:

- `av_user` en `localStorage` sigue sin cambiar de forma (`{ name: string } | null`); lo nuevo es cuándo `nav.tsx` decide escribirlo (ver Scope).
- No hay una tabla ni un flag explícito de "onboarding completo" — la ausencia de `user_metadata.display_name` es la única señal de que un usuario OAuth todavía no pasó por `/choose-username`.

## Implementation plan

1. **Callback route de OAuth.** Crear `app/auth/callback/route.ts`: lee `code` de la query, llama a `supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor; si el usuario resultante no tiene `user_metadata.display_name`, redirige a `/choose-username`; si ya lo tiene, redirige a `/`.
   _Test:_ `npm run build` compila; la ruta no está enlazada desde ningún lado todavía.

2. **Página `/choose-username`.** Crear `app/choose-username/page.tsx`: si no hay sesión activa, redirige a `/login`; si la hay, muestra el formulario de un solo campo, normaliza (mayúsculas, máx. 12) y llama a `supabase.auth.updateUser({ data: { display_name } })`, luego `router.push("/")`.
   _Test:_ `npm run build` compila; visitar `/choose-username` sin sesión redirige a `/login`.

3. **Extender `nav.tsx`.** Agregar el manejo de `USER_UPDATED` en el listener `onAuthStateChange` (sincroniza `av_user` cuando se guarda el nombre); en `SIGNED_IN`, si `user_metadata.display_name` no existe, no escribir `av_user` todavía.
   _Test:_ `npm run build` compila; el flujo de email/contraseña de spec 17 (que siempre tiene `display_name` desde el registro) sigue funcionando sin cambios.

4. **Activar los botones en `auth-form.tsx`.** Quitar el `hidden`/condicional de spec 17 sobre el divisor y los botones GOOGLE/GITHUB en ambas pestañas; wirear `onClick` a `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}/auth/callback` } })`.
   _Test manual:_ hacer clic en GOOGLE o GITHUB redirige al proveedor (aunque falle por no estar configurado todavía — se confirma en el paso 5).

5. **Paso manual (usuario): configurar los proveedores.** Crear el OAuth Client de Google y la OAuth App de GitHub con el callback URL de Supabase, y cargar Client ID/Secret en el dashboard de Supabase (Authentication → Providers).
   _Test:_ el dashboard de Supabase muestra ambos proveedores como habilitados.

6. **Flujo end-to-end.** Iniciar sesión con GOOGLE (o GITHUB) por primera vez → tras el consentimiento del proveedor, cae en `/auth/callback` → redirige a `/choose-username` → fijar nombre → redirige a `/` con `nav.tsx` mostrando el nombre. Cerrar sesión e iniciar sesión de nuevo con el mismo proveedor → esta vez `/auth/callback` redirige directo a `/`, sin pasar por `/choose-username`.
   _Test manual:_ confirmar ambos casos (primer login vs. login recurrente) con al menos un proveedor real.

7. **Traducciones.** Agregar a `dict.auth` (ES y EN) las claves de `/choose-username` (título, campo, botón, error de nombre vacío).
   _Test:_ alternar ES/EN en `/login` y `/choose-username` sin claves faltantes ni errores de consola.

## Acceptance criteria

- [x] `npm run dev` y `npm run build` no muestran errores tras cada paso del plan.
- [x] Los botones GOOGLE y GITHUB, con su divisor "O CONTINÚA CON", son visibles en ambas pestañas de `/login`.
- [ ] Hacer clic en GOOGLE o GITHUB redirige al proveedor correspondiente para autenticarse. _(pendiente: requiere proveedores configurados en el dashboard de Supabase — paso 5, manual)_
- [ ] El primer login con una cuenta OAuth nueva redirige a `/choose-username` en vez de `/`. _(pendiente: requiere prueba manual con proveedor real)_
- [ ] En `/choose-username`, intentar continuar con el campo vacío muestra un error y no llama a `updateUser`. _(pendiente: requiere prueba manual en navegador)_
- [ ] Guardar un nombre válido en `/choose-username` redirige a `/` con `nav.tsx` mostrando ese nombre. _(pendiente: requiere prueba manual)_
- [ ] Cerrar sesión y volver a iniciar sesión con la misma cuenta OAuth ya onboardeada redirige directo a `/`, sin pasar por `/choose-username`. _(pendiente: requiere prueba manual)_
- [ ] Visitar `/choose-username` sin sesión activa redirige a `/login`. _(pendiente: requiere prueba manual en navegador)_
- [ ] Tras completar el onboarding OAuth, entrar a cualquiera de los 7 juegos precarga el mismo nombre en el modal de puntuación, sin haber tocado ningún archivo de `components/games/`. _(pendiente: requiere prueba manual; el código no tocó `components/games/`)_
- [ ] El flujo de email/contraseña de spec 17 (registro, login, confirmación) sigue funcionando sin cambios de comportamiento. _(pendiente: requiere prueba manual)_
- [ ] El flujo de recuperación de contraseña de spec 18 sigue funcionando sin cambios de comportamiento. _(pendiente: requiere prueba manual)_
- [x] Alternar ES/EN en `/login` y `/choose-username` muestra todos los textos traducidos, sin claves faltantes.
- [x] Ninguno de los 7 reproductores de juego, `game-player.tsx` ni `hall-of-fame-board.tsx` cambia de código en este spec.

## Decisions

- **Sí:** callback OAuth dedicado (`app/auth/callback/route.ts`) en vez de extender `app/auth/confirm/route.ts`. Son mecanismos de Supabase genuinamente distintos — `exchangeCodeForSession(code)` para OAuth vs. `verifyOtp({ token_hash, type })` para los enlaces de correo de specs 17/18 — mezclarlos en una sola ruta habría confundido ambos flujos sin ganar nada.
- **Sí:** onboarding obligatorio en `/choose-username`, sin opción de omitir. Decisión ya tomada en spec 17 (pedir nombre en vez de derivarlo del proveedor) y confirmada aquí; permitir saltarlo dejaría usuarios con nombres autogenerados que contradicen esa decisión.
- **Sí:** la ausencia de `user_metadata.display_name` como única señal de "necesita onboarding", sin un flag booleano nuevo. Reutiliza el mismo campo que ya usa el flujo de email/contraseña; agregar un flag aparte sería redundante.
- **Sí:** botones GOOGLE/GITHUB visibles en ambas pestañas de `auth-form.tsx`. OAuth no distingue registro de login — Supabase crea la cuenta la primera vez y la reconoce después — así que restringirlos a una sola pestaña habría sido arbitrario.
- **Sí:** extender `nav.tsx` para escuchar `USER_UPDATED` y para no escribir `av_user` cuando `display_name` todavía no existe. Sin este ajuste, el mirror hacia `av_user` (construido en spec 17) escribiría un nombre vacío mientras el usuario está en camino a `/choose-username`, rompiendo el HUD y el leaderboard.
- **No:** vincular manualmente una cuenta OAuth con una cuenta email/contraseña del mismo correo. Se deja el comportamiento por defecto de Supabase (ver Risks); resolverlo con UI propia es trabajo no pedido y no trivial.
- **No:** otros proveedores OAuth (Discord, Twitter/X, etc.). Solo Google y GitHub, como se especificó.
- **No:** editar el nombre de jugador después del onboarding inicial. Mismo criterio que specs 17/18 — no hay página de perfil en el catálogo actual.
- **Sí (supuesto):** el paso manual de configurar Google Cloud Console y GitHub OAuth App se documenta como prerrequisito explícito, igual que `.env.local` en spec 04 y la Site URL en spec 17 — sin él, los botones existen pero cualquier intento de OAuth falla en Supabase.

## Risks

| Riesgo                                                                                                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Si alguien ya tiene una cuenta email/contraseña con un correo, y luego inicia sesión con OAuth usando ese mismo correo, el comportamiento (cuentas separadas vs. vinculadas) depende de la configuración por defecto de Supabase, no de código propio. | Se documenta como comportamiento no resuelto por este spec (ver Decisions); si el proyecto necesita vinculación explícita, es un spec futuro de gestión de cuenta.                                                                     |
| Sin los Client ID/Secret cargados en el dashboard de Supabase (paso manual), los botones GOOGLE/GITHUB existen pero el intento de OAuth falla con un error de Supabase.                                                                                | El paso 5 del plan y el criterio de aceptación correspondiente verifican explícitamente que los proveedores queden habilitados antes de dar el spec por cerrado.                                                                       |
| El guard en `nav.tsx` que evita escribir `av_user` cuando falta `display_name` podría dejar la Nav en un estado "sin usuario" visualmente confuso mientras el usuario está en `/choose-username` (ni logueado ni invitado).                            | Es el comportamiento esperado y transitorio — dura solo hasta que se guarda el nombre en `/choose-username`, que redirige de inmediato a `/`; no se considera un bug de esta implementación.                                           |
| Un usuario podría cerrar la pestaña o navegar fuera durante `/choose-username`, quedando con una cuenta OAuth activa pero sin `display_name`.                                                                                                          | La próxima vez que inicie sesión (OAuth o visitando el sitio con la sesión aún viva), `app/auth/callback/route.ts` o el guard de `nav.tsx` lo detectan por la misma señal (`display_name` ausente) y lo regresan a `/choose-username`. |

## Lo que **no** está en este spec

- Otros proveedores OAuth (Discord, Twitter/X, etc.).
- Vinculación manual de una cuenta OAuth con una cuenta email/contraseña del mismo correo.
- Editar el nombre de jugador después del onboarding inicial.
- Recuperación de contraseña — ya cubierta en `specs/18-auth-reset-password.md`.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx` o `hall-of-fame-board.tsx`.

Cada uno de estos, si se implementa, va en su propio spec.
