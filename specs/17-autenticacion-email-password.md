# SPEC 17 — Autenticación email/contraseña

> **Status:** Approved
> **Depends on:** 04-supabase-integration
> **Date:** 2026-08-03
> **Objective:** Reemplazar el formulario de auth mockeado (`components/auth-form.tsx`) por registro e inicio de sesión reales con Supabase Auth (email/contraseña, con confirmación por correo), sesión persistida vía SSR/middleware, y sincronización del nombre mostrado hacia `av_user` en `localStorage` para no tocar los 7 reproductores de juego ni el resto del sitio, manteniendo intacto el modo invitado.

## Why this spec exists

El spec 04 (`04-supabase-integration.md`) instaló y dejó listos los clientes de Supabase (`lib/supabase/client.ts` / `server.ts`) pero dejó explícitamente fuera "migrar `av_user`/`localStorage` a Supabase Auth real (login, registro, logout, sesión)". Este spec cierra ese pendiente.

Es el primero de tres specs de autenticación, pensados para implementarse en orden porque los otros dos dependen de la base que este establece:

- **17 (este spec):** registro, login, logout y sesión con email/contraseña — la base.
- **18 — `auth-reset-password`:** recuperación de contraseña ("¿Olvidaste tu contraseña?").
- **19 — `auth-oauth-social`:** login con Google y GitHub (los botones ya existen en el mock actual, pero no hacen nada).

Se partió en tres porque, tratado como una sola feature, tocaba más de cinco frentes distintos del sistema (registro/confirmación, reset de contraseña, OAuth, sesión SSR, y la migración de los 7 reproductores que leen `av_user`) — demasiado para revisar y aprobar de una sola vez.

## Scope

**In:**

- Registro real con Supabase Auth (`supabase.auth.signUp`): campos Nombre de usuario (display name, mayúsculas, máx. 12 caracteres — misma convención que hoy), Correo electrónico, Contraseña. El display name se guarda en `user_metadata.display_name`.
- Confirmación de correo obligatoria antes de poder iniciar sesión (config. "Confirm email" de Supabase Auth, verificada como paso manual en el dashboard). Tras registrarse, la tarjeta de `auth-form.tsx` muestra un estado "revisa tu correo" en vez de navegar.
- Route Handler `app/auth/confirm/route.ts`: recibe el enlace del correo de confirmación (`token_hash` + `type`), llama a `supabase.auth.verifyOtp`, y redirige a `/` con la sesión ya activa.
- Inicio de sesión real (`supabase.auth.signInWithPassword`) con Correo electrónico + Contraseña (ya no "Usuario" — el login pasa a ser por email).
- Cierre de sesión real (`supabase.auth.signOut()`) desde `components/nav.tsx`.
- Sesión SSR persistida vía cookies: `middleware.ts` (raíz) + `lib/supabase/middleware.ts` (helper `updateSession`), patrón estándar de `@supabase/ssr` para Next.js App Router.
- `components/nav.tsx` añade `supabase.auth.onAuthStateChange`: en `SIGNED_IN` escribe `{ name: display_name }` en `av_user` (localStorage) y actualiza su estado `user`; en `SIGNED_OUT` borra `av_user`. Este es el único punto de sincronización — el resto del sitio sigue leyendo `av_user` sin cambios.
- `components/auth-form.tsx` reescrito: estados de carga (botón deshabilitado durante la llamada) y de error (banner traducido, con casos mapeados para credenciales inválidas y correo ya registrado, más un fallback genérico). Los botones "GOOGLE"/"GITHUB" y su divisor se ocultan en este spec. "JUGAR COMO INVITADO" sigue funcionando exactamente igual que hoy (sin tocar Supabase).
- Nuevas claves en `dict.auth` (`lib/i18n/translations.ts`, ES y EN): error genérico, error de credenciales inválidas, error de correo ya registrado, título/cuerpo del estado "revisa tu correo", label del campo de email para inicio de sesión.
- Paso manual (usuario): verificar en el dashboard de Supabase que "Confirm email" está activo y que la Site URL / Redirect URLs incluyen la URL de la app (`http://localhost:3000` en desarrollo) para que el enlace de confirmación funcione.

**Out of scope (para otro spec):**

- Recuperación de contraseña ("¿Olvidaste tu contraseña?") — `specs/18-auth-reset-password.md`.
- OAuth con Google/GitHub — `specs/19-auth-oauth-social.md`.
- Vincular `scores.player_name` a un `user_id`/FK real — sigue siendo texto libre, decisión explícita ya tomada.
- Página de editar perfil, cambiar contraseña estando logueado, eliminar cuenta, o cambiar el nombre de jugador después de registrarse.
- Botón de reenvío de correo de confirmación.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx` o `hall-of-fame-board.tsx` — siguen leyendo `av_user` igual que hoy.
- Rate limiting o CAPTCHA más allá de lo que trae Supabase por defecto.
- Gamepad físico y tests automatizados.

## Data model

Este spec no crea tablas nuevas — Supabase Auth gestiona `auth.users` internamente. Los cambios son de configuración y de forma de los datos existentes:

```ts
// user_metadata guardado en supabase.auth.signUp({ email, password, options: { data } })
type SignUpMetadata = {
  display_name: string; // normalizado: mayúsculas, máx. 12 caracteres, mismo criterio que hoy usa saveUser()
};

// av_user en localStorage — forma sin cambios respecto a hoy
// (nav.tsx agregó luego un campo opcional `email`, usado por el menú de usuario)
type AvUser = { name: string } | null;

// lib/supabase/middleware.ts
export function updateSession(request: NextRequest): Promise<NextResponse>;
// crea un cliente Supabase ligado a las cookies del request/response, refresca el token si hace falta

// app/auth/confirm/route.ts
// GET ?token_hash=...&type=email — llama a supabase.auth.verifyOtp({ token_hash, type }), redirige a "/"
```

Convenciones:

- `av_user` sigue siendo la única fuente que leen los 7 reproductores, `game-player.tsx` y `hall-of-fame-board.tsx`; con sesión real, su valor lo escribe el listener de `onAuthStateChange` en `nav.tsx`, no el formulario de login directamente.
- El normalizado de `display_name` (mayúsculas, máx. 12 caracteres) se aplica una sola vez, en el submit de "CREAR CUENTA" antes de mandarlo a Supabase — igual que hoy hace `saveUser()` en `auth-form.tsx`.
- `scores.player_name` no cambia de tipo ni de origen: sigue siendo el valor de `av_user.name` en el momento de guardar, sea cuenta real o invitado.

## Implementation plan

1. **Middleware de sesión.** Antes de escribir código, revisar `node_modules/next/dist/docs/01-app/` para confirmar la forma vigente de `middleware.ts` en Next.js 16.2.10 (firma de `NextRequest`/`NextResponse`, ubicación del archivo). Crear `lib/supabase/middleware.ts` (`updateSession(request)`, cliente Supabase ligado a las cookies del request/response) y `middleware.ts` en la raíz que lo invoca sobre todas las rutas salvo estáticos.
   _Test:_ `npm run dev` sigue funcionando sin cambios de comportamiento visibles; `npm run build` compila.

2. **Route handler de confirmación.** Crear `app/auth/confirm/route.ts`: lee `token_hash` y `type` de la query, llama a `supabase.auth.verifyOtp(...)` con el cliente de servidor, y redirige a `/`.
   _Test:_ `npm run build` compila; la ruta no está enlazada desde ningún lado todavía, así que no hay cambio visible.

3. **Reescribir `auth-form.tsx` — registro.** Pestaña "CREAR CUENTA": el submit normaliza el nombre (mayúsculas, máx. 12) y llama a `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`; en éxito, la tarjeta cambia a un estado "revisa tu correo" (sin `router.push`); en error, banner traducido bajo el botón. Ocultar el divisor y los botones GOOGLE/GITHUB.
   _Test manual:_ registrar un correo real en `/login` → aparece el estado "revisa tu correo" → llega el email de Supabase.

4. **Confirmar y validar sesión.** Abrir el enlace del correo → cae en `/auth/confirm` → redirige a `/`.
   _Test manual:_ tras el redirect, recargar `/` no pierde la sesión (cookie persistida); `av_user` todavía no se sincroniza (eso es el paso 6), así que la Nav puede no reflejarlo aún — se valida en el paso 6.

5. **Reescribir `auth-form.tsx` — inicio de sesión.** Pestaña "INICIAR SESIÓN": reemplazar el campo "Usuario" por "Correo electrónico"; el submit llama a `supabase.auth.signInWithPassword({ email, password })`; en éxito `router.push("/")`; en error, banner traducido (credenciales inválidas / correo no confirmado / genérico).
   _Test manual:_ iniciar sesión con el correo confirmado del paso 4 funciona; con contraseña incorrecta muestra el error correspondiente.

6. **Sincronizar `nav.tsx` con la sesión real.** Añadir `supabase.auth.onAuthStateChange`: en `SIGNED_IN` escribe `{name: display_name}` en `av_user` y actualiza el estado `user` de la Nav; en `SIGNED_OUT` borra `av_user`. El botón de cerrar sesión llama a `supabase.auth.signOut()`.
   _Test manual:_ tras iniciar sesión, la Nav muestra el nombre; entrar a cualquier juego (p. ej. `/games/snake/play`) precarga el mismo nombre en el modal de puntuación; cerrar sesión vuelve la Nav a "Iniciar sesión" y `av_user` desaparece de `localStorage`; "JUGAR COMO INVITADO" sigue funcionando sin iniciar sesión.

7. **Traducciones.** Agregar a `dict.auth` (ES y EN) las claves nuevas: error genérico, error de credenciales inválidas, error de correo ya registrado, error de correo no confirmado, título/cuerpo de "revisa tu correo", label del campo de email en inicio de sesión.
   _Test:_ alternar ES/EN en `/login` en cada estado (formulario, error, revisa tu correo) sin claves faltantes ni errores de consola.

## Acceptance criteria

- [ ] `npm run dev` y `npm run build` no muestran errores tras cada paso del plan.
- [ ] Registrarse con un correo real en `/login` crea el usuario en Supabase Auth y muestra el estado "revisa tu correo" sin navegar fuera de `/login`.
- [ ] Intentar iniciar sesión antes de confirmar el correo muestra un error de "correo no confirmado", no un error genérico.
- [ ] Abrir el enlace de confirmación del correo activa la sesión y redirige a `/`.
- [ ] Iniciar sesión con correo/contraseña correctos tras confirmar redirige a `/` con sesión activa.
- [ ] Iniciar sesión con contraseña incorrecta muestra un error de credenciales inválidas sin crashear el formulario.
- [ ] Intentar registrarse con un correo ya usado muestra un error de "correo ya registrado".
- [ ] Tras iniciar sesión, `components/nav.tsx` muestra el `display_name` de la cuenta, tanto en escritorio como en el panel móvil.
- [ ] Con sesión activa, entrar a cualquiera de los 7 juegos precarga el mismo nombre en el modal de puntuación, sin haber tocado ningún archivo de `components/games/`.
- [ ] Cerrar sesión desde la Nav llama a `supabase.auth.signOut()`, limpia `av_user` de `localStorage`, y la Nav vuelve a mostrar "Iniciar sesión".
- [ ] Recargar la página con sesión activa conserva la sesión (verifica que `middleware.ts` refresca la cookie correctamente).
- [ ] "JUGAR COMO INVITADO" sigue funcionando exactamente igual que antes de este spec, sin llamar a Supabase.
- [ ] Los botones GOOGLE/GITHUB y su divisor no aparecen en el formulario en este spec.
- [ ] Alternar ES/EN en `/login` muestra todos los textos (formulario, errores, estado "revisa tu correo") traducidos, sin claves faltantes.
- [ ] Ninguno de los 7 reproductores de juego, `game-player.tsx` ni `hall-of-fame-board.tsx` cambia de código en este spec.

## Decisions

- **Sí:** login por correo electrónico en vez del campo "Usuario" original. Supabase Auth autentica de forma nativa por email/contraseña; mantener "Usuario" como identificador de login habría requerido una tabla puente username→email no pedida.
- **No:** tabla puente username→email. Descartada en la pregunta de aclaración inicial a favor de login por correo.
- **Sí:** modo invitado se mantiene intacto, sin pasar por Supabase. La autenticación es opcional para jugar, no obligatoria — así funciona hoy y no hay razón para cambiarlo en un spec de auth.
- **Sí:** confirmación de correo obligatoria antes de poder iniciar sesión. Decisión explícita del usuario sobre robustez frente a correos falsos, aunque agrega el estado "revisa tu correo" y el route handler de confirmación.
- **No:** botón de reenvío de confirmación. No se pidió y no hay precedente de UI para eso en el catálogo actual; si se pierde el correo, se puede volver a intentar el registro.
- **Sí:** sesión SSR con `middleware.ts` en vez de solo cliente. Es el patrón oficial de `@supabase/ssr` para Next.js App Router, y `lib/supabase/server.ts` ya está escrito esperando cookies — dejar la sesión solo en el cliente la volvería invisible para Server Components sin razón.
- **Sí:** `nav.tsx` como único punto de sincronización entre la sesión real de Supabase y `av_user` en `localStorage`, en vez de tocar los 7 reproductores de juego. Nav ya es global (`app/layout.tsx`) y ya lee/escribe `av_user` hoy; esto mantiene el radio de cambio mínimo y cumple la nota de `CLAUDE.md` de tratar la infraestructura compartida como contratos fijos.
- **No:** vincular `scores.player_name` a un `user_id`/FK real. Decisión explícita tomada en la fase de preguntas — el modelo de puntuaciones sigue siendo texto libre, sin ligar a la cuenta.
- **No:** OAuth (Google/GitHub) en este spec, aunque los botones ya existen en el mock. Se ocultan aquí y se implementan en `specs/19-auth-oauth-social.md`, que depende de este.
- **No:** recuperación de contraseña en este spec. Va en `specs/18-auth-reset-password.md`, que depende de este.
- **No:** página de editar perfil, cambiar contraseña logueado, eliminar cuenta, o cambiar el nombre de jugador después de registrarse. No se pidieron y no hay precedente de gestión de cuenta en el catálogo actual.
- **Sí (supuesto):** los mensajes de error se mapean a un pequeño conjunto traducido (credenciales inválidas, correo ya registrado, correo no confirmado, genérico) en vez de mostrar el `error.message` crudo de Supabase (que viene en inglés). Mantiene la UI coherente con el resto del sitio, que está en ES/EN vía `dict`.

## Risks

| Riesgo                                                                                                                                                                                         | Mitigación                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La API de `middleware.ts`/`NextRequest`/`NextResponse` en Next.js 16.2.10 podría diferir de lo conocido por entrenamiento.                                                                     | Paso 1 del plan revisa explícitamente `node_modules/next/dist/docs/01-app/` antes de escribir el middleware, igual que hizo el spec 04 con `cookies()`.                                   |
| Si "Confirm email" no está activo en el dashboard de Supabase, el registro deja sesión activa de inmediato y el paso 4 (confirmación) queda sin efecto observable.                             | Paso manual documentado en el Scope: verificar la configuración en el dashboard antes de dar el spec por cerrado; el criterio de aceptación de "correo no confirmado" lo expone si falla. |
| Sin Site URL/Redirect URLs correctas en Supabase, el enlace de confirmación podría redirigir a un dominio equivocado o fallar.                                                                 | Paso manual documentado en el Scope, igual que `.env.local` en el spec 04.                                                                                                                |
| El listener `onAuthStateChange` en `nav.tsx` podría no haberse montado todavía cuando un reproductor de juego lee `av_user` en el primer render tras confirmar el correo (carrera de montaje). | Nav es global en `app/layout.tsx` y se monta antes que cualquier página hija; se valida explícitamente en el paso 6 navegando a un juego después de iniciar sesión, no antes.             |
| Ocultar los botones GOOGLE/GITHUB sin eliminar sus claves de `dict.auth` podría tentar a dejarlas huérfanas o desincronizadas cuando llegue el spec 19.                                        | Las claves se mantienen intactas (no se borran), documentado aquí para que el spec 19 las reutilice en vez de recrearlas.                                                                 |

## Lo que **no** está en este spec

- Recuperación de contraseña ("¿Olvidaste tu contraseña?") — `specs/18-auth-reset-password.md`.
- OAuth con Google/GitHub — `specs/19-auth-oauth-social.md`.
- Vincular `scores.player_name` a un `user_id`/FK real.
- Página de editar perfil, cambiar contraseña logueado, eliminar cuenta, o cambiar el nombre de jugador después de registrarse.
- Botón de reenvío de correo de confirmación.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx` o `hall-of-fame-board.tsx`.
- Rate limiting o CAPTCHA más allá de lo que trae Supabase por defecto.
- Gamepad físico y tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
