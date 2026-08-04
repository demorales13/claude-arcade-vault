# SPEC 21 — Checklist de seguridad básico

> **Status:** Implemented
> **Depends on:** 04-supabase-integration, 06-leaderboard-catalogo-supabase, 17-autenticacion-email-password, 18-auth-reset-password, 20-username-unico
> **Date:** 2026-08-04
> **Objective:** Cerrar los ítems pendientes del checklist de seguridad básico — corregir la vista `games_with_stats` (SECURITY DEFINER), añadir headers de seguridad HTTP en Next.js, validar en el cliente los requisitos de contraseña de Supabase (mínimo 8 caracteres, mayúscula, minúscula, dígito y símbolo) antes de enviarla, y documentar los ajustes manuales de Auth (leaked password protection, rate limit de signup) — dejando constancia de que RLS ya estaba resuelto de specs previos.

## Por qué este spec existe

`security-checklist.md` (sin trackear en el repo, generado tras revisar el panel de Supabase) junta cinco pendientes de distinta naturaleza: uno de base de datos (RLS) que ya estaba resuelto por specs 06/20, un ERROR real del linter de Supabase (`games_with_stats` como `SECURITY DEFINER`), dos ajustes que solo existen en el dashboard de Auth (leaked password protection, rate limit de signup), y un ítem de código nuevo (headers HTTP en Next.js). A esto se suma un pendiente que no estaba en el checklist original: la captura de pantalla de la config de Auth (mínimo 8 caracteres + mayúscula + minúscula + dígito + símbolo) reveló que ni `auth-form.tsx` ni `update-password/page.tsx` validan el formato de la contraseña antes de enviarla a Supabase — hoy cualquier intento con una contraseña débil hace un round-trip completo a Supabase solo para recibir un rechazo genérico.

La validación en el cliente que agrega este spec es una mejora de UX, no un límite de seguridad nuevo: la config real (mínimo 8, cuatro clases de carácter) ya vive y se aplica del lado de Supabase según la captura adjunta; este spec solo espeja esa misma regla en JS para dar feedback inmediato sin depender de la respuesta del servidor.

## Scope

**In:**

- Vista `public.games_with_stats`: `alter view ... set (security_invoker = true)` — un solo `ALTER` ejecutado en el SQL Editor de Supabase (confirmado Postgres 17, soporta la opción nativamente).
- Headers de seguridad en `next.config.ts` vía `headers()`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy` (`camera=(), microphone=(), geolocation=()`), aplicados a todas las rutas.
- Helper compartido `lib/password.ts` (mismo patrón que `lib/username.ts`): `isValidPassword(pass: string): boolean` — mínimo 8 caracteres, al menos una minúscula, una mayúscula, un dígito y un símbolo (cualquier carácter no alfanumérico).
- Conectar `isValidPassword` en `components/auth-form.tsx` (solo pestaña CREAR CUENTA, antes de llamar `supabase.auth.signUp`) y en `app/update-password/page.tsx` (antes de llamar `supabase.auth.updateUser`, y antes del chequeo de coincidencia ya existente).
- Nueva clave `dict.auth.errorPasswordWeak` (ES/EN).
- Documentar en este spec que RLS ya está habilitado con policies coherentes en `games`, `scores` y `profiles` (confirmado vía `pg_policies` y `list_tables`) — sin tocar código ni policies.
- `proxy.ts` protege `/choose-username` y `/update-password`: en `lib/supabase/middleware.ts`, tras refrescar la sesión, si la ruta visitada está en una lista `PROTECTED_PATHS` y no hay usuario autenticado, redirige a `/login` antes de renderizar. Reemplaza el check duplicado que hoy vive solo en `app/choose-username/page.tsx` (que se elimina) y cubre `/update-password`, que hoy no tiene ningún guard.
- Paso manual (usuario): activar **Leaked Password Protection** en el dashboard de Supabase (Authentication → Policies/Providers, según versión del dashboard).
- Paso manual (usuario): confirmar que el rate limit de "Sign ups and Sign ins" por IP está activo en Authentication → Rate Limits, dejando el valor por defecto de Supabase.
- Corrección de la nota stale en `CLAUDE.md` ("el siguiente número libre es 21" → 22, tras crear este spec).

**Out of scope (para otro spec):**

- `Content-Security-Policy`. No estaba en el checklist original y diseñarlo mal puede romper estilos/scripts inline o la carga desde Supabase; se deja para un spec dedicado si se pide.
- Auditar si las policies de RLS existentes (lectura pública total, insert público en `scores`) son demasiado permisivas — decisión explícita: solo se documenta que ya existen.
- Checklist en vivo de requisitos de contraseña mientras se escribe (se eligió error único al enviar).
- Campo de "confirmar contraseña" en la pestaña CREAR CUENTA de `auth-form.tsx` — no existe hoy y no fue pedido.
- Cambiar la configuración de contraseña en el dashboard de Supabase (mínimo/clases de carácter) — ya está correctamente configurada según la captura adjunta; este spec solo la espeja en el cliente.
- Fijar un número concreto para el rate limit de signup — se deja el default de Supabase.
- Vinculación de cuentas, otros proveedores OAuth, pantalla de perfil — deuda ya declarada en specs 17/19/20, sin relación con este spec.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx` o `hall-of-fame-board.tsx`.

## Data model

Este spec no crea tablas nuevas. Introduce un helper y una clave de traducción:

```ts
// lib/password.ts
function isValidPassword(pass: string): boolean;
// true si pass.length >= 8 Y contiene al menos:
// una minúscula [a-z], una mayúscula [A-Z], un dígito [0-9], un símbolo (no alfanumérico)
```

Único cambio de esquema, sobre un objeto ya existente (no una tabla nueva):

```sql
alter view public.games_with_stats set (security_invoker = true);
```

Nueva clave de traducción (ES/EN) en `dict.auth`:

```ts
errorPasswordWeak: string; // "La contraseña debe tener 8+ caracteres, mayúscula, minúscula, número y símbolo." / equivalente EN
```

Convenciones:

- `isValidPassword` no reemplaza la validación real de Supabase — es un espejo en el cliente de la config mostrada en la captura adjunta, para evitar un round-trip innecesario. Supabase sigue siendo la única fuente de verdad server-side.
- `PROTECTED_PATHS = ["/choose-username", "/update-password"]` vive como constante en `lib/supabase/middleware.ts`, junto a `updateSession`. No es una lista configurable ni persistida — un array literal en código.

## Implementation plan

1. **Corregir la vista `games_with_stats`.** Ejecutar `alter view public.games_with_stats set (security_invoker = true);` en el SQL Editor de Supabase.
   _Test:_ el advisor de seguridad (`get_advisors` tipo `security`) ya no lista `security_definer_view`; `select * from games_with_stats` como `anon` sigue devolviendo las mismas filas que antes (RLS de `games`/`scores` ya es lectura pública sin restricción).

2. **Headers de seguridad en `next.config.ts`.** Agregar `async headers()` con los 5 headers de la sección Scope, aplicados a `source: '/(.*)'`.
   _Test:_ `npm run build` compila; `npm run dev` + inspeccionar las Response Headers de `/` en el navegador (o `curl -I`) muestra los 5 headers.

3. **Helper `lib/password.ts`.** Crear `isValidPassword`.
   _Test:_ `npm run build` compila; no se usa todavía en ningún componente.

4. **Traducción `errorPasswordWeak`.** Agregar la clave a `dict.auth` en ES y EN.
   _Test:_ `npm run build` compila.

5. **Conectar en `auth-form.tsx`.** En la pestaña CREAR CUENTA, antes de llamar `supabase.auth.signUp`, validar `isValidPassword(pass)`; si falla, mostrar `dict.auth.errorPasswordWeak` y no llamar a Supabase.
   _Test manual:_ intentar crear cuenta con `"abc123"` muestra el error sin ninguna llamada de red a Supabase; con `"Abcdef1!"` procede normalmente.

6. **Conectar en `update-password/page.tsx`.** Antes del chequeo de coincidencia ya existente (`password !== confirmPassword`), validar `isValidPassword(password)`; si falla, mostrar `dict.auth.errorPasswordWeak` y no llamar a `updateUser`.
   _Test manual:_ escribir una contraseña débil en "Nueva contraseña" muestra el error de formato antes de llegar a comparar con "Confirmar contraseña".

7. **Proteger rutas en `proxy.ts`.** En `lib/supabase/middleware.ts`, tras `await supabase.auth.getUser()`, si `request.nextUrl.pathname` está en `PROTECTED_PATHS` (`/choose-username`, `/update-password`) y no hay `user`, devolver `NextResponse.redirect(new URL("/login", request.url))` en vez de `response`. Quitar el check de sesión ahora redundante de `app/choose-username/page.tsx`.
   _Test manual:_ visitar `/choose-username` o `/update-password` sin sesión activa (pestaña de incógnito) redirige a `/login` en ambos casos; visitar `/choose-username` con sesión activa sin `display_name` sigue mostrando el formulario con normalidad.

8. **Paso manual (usuario): Leaked Password Protection.** Activar el toggle en el dashboard de Supabase.
   _Test:_ el advisor de seguridad ya no lista el WARN `auth_leaked_password_protection`.
   _Resultado:_ **bloqueado por el plan del proyecto** — el toggle no se puede activar porque la protección contra contraseñas filtradas solo está disponible en modo producción (no en el plan/entorno actual). Confirmado por el usuario el 2026-08-04. El advisor sigue listando el WARN `auth_leaked_password_protection` y así se queda hasta que el proyecto pase a un plan que lo soporte — no es un pendiente de código de este spec.

9. **Paso manual (usuario): confirmar rate limit de signup.** Revisar en Authentication → Rate Limits que "Sign ups and Sign ins" tiene un límite por IP activo (default de Supabase, sin cambiar el número).
   _Test:_ confirmación visual en el dashboard.

10. **Actualizar `CLAUDE.md`.** Corregir "el siguiente número libre es 21" por "22" (spec 21 ya existe tras este spec).
    _Test:_ lectura manual, sin impacto en build.

## Acceptance criteria

- [x] `npm run build` compila sin errores tras cada paso del plan. Verificado tras cada paso de código.
- [x] `get_advisors(type: "security")` ya no lista `security_definer_view` para `games_with_stats`. Confirmado.
- [x] Una consulta anónima a `games_with_stats` devuelve las mismas filas que antes del cambio (sin regresión de RLS). Confirmado: 6 filas antes y después del `alter view`.
- [x] Las Response Headers de cualquier ruta incluyen `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, y `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Confirmado vía `curl -I` en `/`.
- [x] En la pestaña CREAR CUENTA, una contraseña que no cumple el formato (ej. `"abc123"`) muestra `errorPasswordWeak` sin llamar a `supabase.auth.signUp`. Confirmado por el usuario el 2026-08-04.
- [x] En la pestaña CREAR CUENTA, una contraseña válida (ej. `"Abcdef1!"`) procede a llamar `signUp` con normalidad. Confirmado por el usuario el 2026-08-04.
- [x] En `/update-password`, una contraseña nueva débil muestra `errorPasswordWeak` sin llamar a `updateUser`. Confirmado por el usuario el 2026-08-04.
- [x] En `/update-password`, una contraseña válida que no coincide con la confirmación sigue mostrando `errorPasswordMismatch` (comportamiento existente intacto). Confirmado por el usuario el 2026-08-04.
- [ ] ~~`get_advisors(type: "security")` ya no lista el WARN de leaked password protection tras el paso manual 7.~~ **No aplicable** — la feature requiere modo producción, no disponible en el plan actual (ver paso 8 del plan). Sigue apareciendo el WARN; se retoma cuando el proyecto tenga un plan que la soporte.
- [x] El dashboard de Supabase confirma un rate limit activo para signups por IP (paso manual 8). Confirmado por el usuario el 2026-08-04.
- [x] Alternar ES/EN en `/login` y `/update-password` muestra `errorPasswordWeak` traducido, sin claves faltantes. Confirmado por el usuario el 2026-08-04.
- [x] Visitar `/update-password` sin sesión activa redirige a `/login` (antes no tenía ningún guard). Confirmado vía `curl -I` (307 → `/login`).
- [x] Visitar `/choose-username` sin sesión activa redirige a `/login`, ahora vía `proxy.ts` — `app/choose-username/page.tsx` ya no contiene el check. Confirmado vía `curl -I` (307 → `/login`).
- [x] El flujo real de recuperación de contraseña (spec 18: enlace de correo → `/auth/confirm` → `/update-password`) sigue funcionando, confirmando que la sesión que deja `verifyOtp` es visible para el guard de `proxy.ts`. Confirmado por el usuario el 2026-08-04.
- [x] El flujo de login/registro por email de spec 17, el de recuperación de spec 18, el de OAuth de spec 19 y el de username único de spec 20 siguen funcionando sin cambios de comportamiento. Confirmado por el usuario el 2026-08-04.
- [x] Ninguno de los 7 reproductores de juego, `game-player.tsx` ni `hall-of-fame-board.tsx` cambia de código en este spec. Confirmado: ningún archivo de `components/games/` fue tocado.
- [x] `CLAUDE.md` ya no dice que el siguiente número libre es 21. Actualizado a 22.

## Decisions

- **Sí:** `alter view ... set (security_invoker = true)` en vez de recrear la vista con `security_barrier`. Postgres 17 (confirmado en el proyecto) soporta la opción nativamente; es un cambio de una línea sin tocar columnas ni el `select` de la vista.
- **Sí:** documentar que RLS ya está resuelto (specs 06/20) sin tocar policies. Confirmado por `pg_policies`/`list_tables`: las tres tablas ya tienen RLS habilitado con policies coherentes con el uso actual del catálogo.
- **Sí:** la validación de contraseña en el cliente es solo UX, no un nuevo límite de seguridad — el enforcement real sigue siendo la config de Supabase, ya correcta según la captura adjunta.
- **Sí:** charset de símbolo = cualquier no-alfanumérico (regex amplio), igual de permisivo que el validador real de Supabase, para evitar falsos negativos en el cliente frente a lo que Supabase sí aceptaría.
- **Sí:** feedback como error único al enviar, mismo patrón que `errorPasswordMismatch`/`errorUsernameTaken` ya existentes — sin agregar un componente de checklist en vivo nuevo.
- **Sí:** en `update-password/page.tsx`, validar formato **antes** del chequeo de coincidencia existente — decirle al usuario que su contraseña es débil es más útil que decirle primero que no coincide con la confirmación.
- **Sí:** leaked password protection y rate limit de signup como pasos manuales documentados, mismo patrón que specs 17/19 (Site URL, OAuth Client). No se pueden automatizar vía código de la app.
- **No:** `Content-Security-Policy`. No estaba en el checklist original y diseñarlo mal rompe estilos/scripts inline; se deja para un spec dedicado si se pide.
- **No:** fijar un número concreto para el rate limit de signup — se deja el default de Supabase, solo se confirma que está activo.
- **No:** checklist en vivo de requisitos de contraseña mientras se escribe — se eligió el patrón de error único, más simple y consistente con el resto del formulario.
- **No:** campo de confirmar contraseña en la pestaña CREAR CUENTA — no fue pedido y no formaba parte del checklist.
- **No:** auditoría de las policies existentes de RLS — decisión explícita del usuario; solo se documenta que ya existen.
- **Sí (revierte spec 20):** guard global en `proxy.ts` para `/choose-username` y `/update-password`. Spec 20 había decidido explícitamente no hacerlo ("las dos señales ya existentes... cubren los puntos de entrada reales sin añadir overhead a cada request"). Se revierte aquí porque (a) `/update-password` nunca tuvo guard, quedando expuesto sin sesión, y (b) centralizar el check evita repetirlo página por página a medida que crecen los flujos de auth. El guard se limita a una lista corta y explícita (`PROTECTED_PATHS`), no a "cualquier ruta visitada" como spec 20 rechazaba.

## Risks

| Riesgo                                                                                                                                                                                                | Mitigación                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `security_invoker = true` en `games_with_stats` podría, en teoría, cambiar qué filas ve un usuario anónimo si las policies de `games`/`scores` no fueran de lectura pública total.                    | Ya se confirmó vía `pg_policies` que ambas tablas tienen policies `SELECT` con `qual: true` (lectura pública sin restricción) — el cambio no altera el resultado para el tráfico actual.                                                                                |
| Los headers `X-Frame-Options: DENY` y `Permissions-Policy` podrían romper alguna función que dependa de iframes o de una API de navegador deshabilitada.                                              | Se confirmó por búsqueda en el repo que no hay uso de `iframe` ni de cámara/micrófono/geolocalización en ningún componente actual; revisar manualmente si se agrega alguna de esas features después.                                                                    |
| `lib/password.ts` puede desincronizarse de la config real de Supabase si alguien cambia los requisitos en el dashboard sin actualizar el código.                                                      | Documentado explícitamente: este spec espeja el estado de la captura adjunta; un cambio futuro en el dashboard requiere actualizar `lib/password.ts` a mano — no hay una única fuente de verdad automática.                                                             |
| Los pasos manuales 8 y 9 dependen de que el usuario los ejecute en el dashboard de Supabase.                                                                                                          | Los criterios de aceptación correspondientes los verifican explícitamente antes de cerrar el spec, mismo patrón que el paso 5 de spec 19.                                                                                                                               |
| Leaked Password Protection (paso 8) resultó no disponible: la feature solo funciona en modo producción, no en el plan/entorno actual del proyecto.                                                    | Aceptado como limitación externa, no como pendiente de este spec. Documentado en el paso 8 del plan y en el criterio de aceptación correspondiente; el WARN `auth_leaked_password_protection` queda abierto hasta que el proyecto tenga un plan que soporte la feature. |
| El guard de `proxy.ts` podría redirigir incorrectamente a `/login` durante el flujo de recuperación si la sesión de `verifyOtp` no fuera visible todavía en la cookie al llegar a `/update-password`. | Confirmado en el código: `app/auth/confirm/route.ts` llama a `verifyOtp` con el cliente de servidor (que sí persiste cookies) y solo redirige tras un `!error`, por lo que la sesión ya está en las cookies antes de que `proxy.ts` la lea.                             |

## Lo que **no** está en este spec

- `Content-Security-Policy`.
- Auditoría de las policies de RLS existentes.
- Checklist en vivo de requisitos de contraseña.
- Campo de confirmar contraseña en CREAR CUENTA.
- Cambiar el valor numérico del rate limit de signup.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx` o `hall-of-fame-board.tsx`.

Cada uno de estos, si se implementa, va en su propio spec.
