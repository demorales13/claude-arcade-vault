# SPEC 18 — Recuperación de contraseña

> **Status:** Approved
> **Depends on:** 17-autenticacion-email-password
> **Date:** 2026-08-03
> **Objective:** Agregar el flujo "¿Olvidaste tu contraseña?" (páginas `/forgot-password` y `/update-password`, más la extensión del route handler de confirmación de spec 17) para que un usuario con cuenta email/contraseña pueda recuperar el acceso sin soporte manual.

## Scope

**In:**

- Enlace "¿Olvidaste tu contraseña?" en la pestaña "INICIAR SESIÓN" de `components/auth-form.tsx`, bajo el campo de contraseña, que navega a `/forgot-password`.
- Página `app/forgot-password/page.tsx`: formulario con un campo Correo electrónico. Al enviarlo, llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/confirm })`. Tras el envío, la tarjeta muestra el mismo tipo de estado "revisa tu correo" ya usado en spec 17 para el registro, independientemente de si el correo tiene cuenta o no (Supabase no distingue este caso por defecto — evita que alguien pueda enumerar qué correos están registrados).
- Extensión de `app/auth/confirm/route.ts` (creado en spec 17): tras `verifyOtp`, si `type === "recovery"` redirige a `/update-password`; si `type === "email"` sigue redirigiendo a `/` exactamente como hoy. Ningún otro comportamiento de ese route handler cambia.
- Página `app/update-password/page.tsx`: formulario con Nueva contraseña + Confirmar contraseña (validación de que coincidan antes de enviar). Llama a `supabase.auth.updateUser({ password })` usando la sesión de recuperación ya activa por el redirect. En éxito, `router.push("/")` — la sesión de recuperación queda como sesión normal, sin pedir un login adicional. En error, banner traducido.
- Nuevas claves en `dict.auth` (ES y EN): label y texto del enlace "¿Olvidaste tu contraseña?", textos de `/forgot-password` (título, campo, botón, estado "revisa tu correo"), textos de `/update-password` (título, campos, botón, error de contraseñas que no coinciden, error genérico).

**Out of scope (para otro spec):**

- OAuth con Google/GitHub — `specs/19-auth-oauth-social.md`, sin relación con este flujo.
- Cambiar la contraseña estando ya logueado (desde un perfil, por ejemplo) — este spec cubre solo el flujo de recuperación por correo cuando no se puede iniciar sesión.
- Políticas de complejidad de contraseña más allá de las que ya aplica Supabase por defecto (mínimo 6 caracteres) — no se agrega validación adicional.
- Límite de reintentos / cooldown visible en la UI para pedir múltiples resets seguidos — se confía en el rate limiting propio de Supabase Auth.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx`, `hall-of-fame-board.tsx` o `nav.tsx`.

## Data model

Este spec no introduce estructuras de datos nuevas ni tablas. Reutiliza el modelo de sesión y `auth.users` ya definidos en `specs/17-autenticacion-email-password.md`; el único dato nuevo de forma es el `type` que ya entrega Supabase en la query del enlace de correo:

```ts
// app/auth/confirm/route.ts — extensión de spec 17
// GET ?token_hash=...&type=email|recovery
// type === "recovery" → redirige a "/update-password"
// type === "email"    → redirige a "/" (sin cambios respecto a spec 17)

// app/update-password/page.tsx — estado local del formulario, no persistido
type UpdatePasswordForm = {
  password: string;
  confirmPassword: string;
};
```

Convenciones:

- No se guarda nada en `localStorage` ni en `av_user` durante este flujo; al llegar a `/` tras el reset, `nav.tsx` sincroniza el nombre exactamente igual que en cualquier inicio de sesión (mecanismo ya construido en spec 17).

## Implementation plan

1. **Extender el route handler de confirmación.** Modificar `app/auth/confirm/route.ts`: leer `type` de la query y, si es `"recovery"`, redirigir a `/update-password` en vez de `/` tras `verifyOtp`. El caso `type === "email"` no cambia.
   _Test:_ `npm run build` compila; repetir el flujo de confirmación de registro de spec 17 (correo real → clic en enlace) sigue redirigiendo a `/` sin cambios.

2. **Página `/update-password`.** Crear `app/update-password/page.tsx`: formulario Nueva contraseña + Confirmar contraseña, valida que coincidan antes de llamar a `supabase.auth.updateUser({ password })`; en éxito `router.push("/")`, en error banner traducido. Aún no está enlazada desde ningún lado.
   _Test:_ `npm run build` compila; visitar `/update-password` sin sesión de recuperación activa muestra el formulario (el submit fallará por falta de sesión, comportamiento esperado y no probado aún en este paso).

3. **Página `/forgot-password`.** Crear `app/forgot-password/page.tsx`: formulario con Correo electrónico que llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` })`; en éxito muestra el estado "revisa tu correo" (mismo patrón visual que el de registro en spec 17), siempre, exista o no la cuenta.
   _Test manual:_ pedir el reset con el correo real registrado en spec 17 → aparece "revisa tu correo" → llega el email de Supabase.

4. **Flujo end-to-end.** Abrir el enlace del correo → cae en `/auth/confirm?type=recovery&...` → redirige a `/update-password` → fijar nueva contraseña → redirige a `/` con sesión activa.
   _Test manual:_ tras el redirect a `/`, `nav.tsx` muestra el nombre de la cuenta (sincronización de spec 17); cerrar sesión e iniciar sesión de nuevo con la contraseña nueva funciona; con la contraseña vieja falla con el error de credenciales inválidas.

5. **Enlazar desde el login.** Agregar el enlace "¿Olvidaste tu contraseña?" bajo el campo de contraseña en la pestaña "INICIAR SESIÓN" de `components/auth-form.tsx`, apuntando a `/forgot-password`.
   _Test manual:_ desde `/login`, el enlace navega a `/forgot-password`.

6. **Traducciones.** Agregar a `dict.auth` (ES y EN) las claves del enlace, de `/forgot-password` y de `/update-password`.
   _Test:_ alternar ES/EN en `/login`, `/forgot-password` y `/update-password` sin claves faltantes ni errores de consola.

## Acceptance criteria

- [x] `npm run dev` y `npm run build` no muestran errores tras cada paso del plan.
- [x] El enlace "¿Olvidaste tu contraseña?" aparece en la pestaña "INICIAR SESIÓN" de `/login` y navega a `/forgot-password`.
- [ ] Pedir el reset en `/forgot-password` con un correo registrado muestra "revisa tu correo" y llega el email de Supabase. _(pendiente: requiere prueba manual con correo real)_
- [ ] Pedir el reset con un correo no registrado muestra exactamente el mismo estado "revisa tu correo" (sin revelar que la cuenta no existe). _(pendiente: requiere prueba manual)_
- [ ] Abrir el enlace del correo de recuperación redirige a `/update-password` (no a `/`). _(pendiente: requiere prueba manual con correo real)_
- [ ] En `/update-password`, si las contraseñas no coinciden se muestra un error y no se llama a `updateUser`. _(pendiente: requiere prueba manual en navegador)_
- [ ] Fijar una nueva contraseña válida en `/update-password` redirige a `/` con sesión activa. _(pendiente: requiere prueba manual)_
- [ ] Tras el reset, cerrar sesión e iniciar sesión con la contraseña nueva funciona. _(pendiente: requiere prueba manual)_
- [ ] Tras el reset, iniciar sesión con la contraseña anterior falla con el error de credenciales inválidas. _(pendiente: requiere prueba manual)_
- [ ] El flujo de confirmación de registro de spec 17 (`type === "email"`) sigue redirigiendo a `/` sin cambios de comportamiento. _(pendiente: requiere prueba manual con correo real)_
- [x] Alternar ES/EN en `/login`, `/forgot-password` y `/update-password` muestra todos los textos traducidos, sin claves faltantes.
- [x] Ninguno de los 7 reproductores de juego, `game-player.tsx`, `hall-of-fame-board.tsx` ni `nav.tsx` cambia de código en este spec.

## Decisions

- **Sí:** enlace en la pestaña existente de inicio de sesión en vez de una tercera pestaña. Mantiene `auth-form.tsx` simple y separa el flujo de recuperación (que necesita sus propias pantallas de éxito/error) en páginas dedicadas, en vez de forzarlo dentro del mismo card con pestañas.
- **No:** tercera pestaña "RECUPERAR" en `auth-form.tsx`. Habría mezclado el estado de un formulario de una sola acción con la lógica de tabs existente sin ganar nada.
- **Sí:** rutas de primer nivel `/forgot-password` y `/update-password`, siguiendo el mismo patrón plano que el resto del sitio (`/games`, `/about`, `/hall-of-fame`) en vez de anidarlas bajo `/login`.
- **Sí:** extender `app/auth/confirm/route.ts` (spec 17) con un branch por `type` en vez de duplicar una ruta nueva. Evita repetir la llamada a `verifyOtp` y mantiene un solo lugar que entiende los enlaces de correo de Supabase.
- **Sí:** tras fijar la nueva contraseña, entrar directo a `/` con la sesión de recuperación ya activa, en vez de forzar un login adicional. Mismo criterio de baja fricción que la confirmación de registro en spec 17; `updateUser()` ya deja una sesión válida, pedir un login extra sería redundante.
- **Sí (impuesto por Supabase, no una elección de diseño):** mostrar siempre "revisa tu correo" al pedir un reset, exista o no la cuenta. Es el comportamiento por defecto de `resetPasswordForEmail` (no distingue el caso de correo inexistente), y es además la práctica estándar de seguridad para no permitir enumeración de cuentas.
- **No:** política de complejidad de contraseña adicional a la de Supabase (mínimo 6 caracteres). No se pidió y no hay precedente de una regla más estricta en el proyecto.
- **No:** límite de reintentos visible en la UI para pedir resets repetidos. Se confía en el rate limiting propio de Supabase Auth; agregar uno propio duplicaría protección ya existente.
- **No:** cambiar contraseña estando logueado (desde un perfil). Es un caso de uso distinto (usuario que sí puede iniciar sesión) y no hay página de perfil en el catálogo actual — queda fuera hasta que exista una.

## Risks

| Riesgo                                                                                                                                                                                                           | Mitigación                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extender `app/auth/confirm/route.ts` con el branch de `recovery` podría romper accidentalmente el caso `email` ya verificado en spec 17.                                                                         | El paso 1 del plan exige repetir manualmente el flujo de confirmación de registro de spec 17 después del cambio, antes de seguir con los pasos siguientes.             |
| La sesión de recuperación que Supabase activa vía el enlace del correo tiene una expiración corta; si el usuario tarda en llegar a `/update-password`, `updateUser` podría fallar por sesión vencida.            | Se trata como cualquier otro error de Supabase: banner traducido genérico en `/update-password`, sin manejo especial — el usuario simplemente vuelve a pedir el reset. |
| Si la Site URL / Redirect URLs configuradas en el dashboard de Supabase (paso manual de spec 17) no incluyen el origen correcto, `redirectTo` en `resetPasswordForEmail` podría no coincidir y el enlace fallar. | Mismo paso manual ya documentado en spec 17 — no se repite aquí, pero es una dependencia directa de que ese paso siga vigente.                                         |

## Lo que **no** está en este spec

- OAuth con Google/GitHub — `specs/19-auth-oauth-social.md`.
- Cambiar la contraseña estando ya logueado (desde un perfil).
- Políticas de complejidad de contraseña adicionales a las de Supabase por defecto.
- Límite de reintentos visible en la UI para pedir resets repetidos.
- Cualquier cambio a los 7 reproductores de juego, `game-player.tsx`, `hall-of-fame-board.tsx` o `nav.tsx`.

Cada uno de estos, si se implementa, va en su propio spec.
