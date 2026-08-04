# SPEC 04 — Integración de Supabase (Auth + Database)

> **Status:** Implemented
> **Depends on:** 01-mvp-visual, 02-home-landing, 03-about-contact
> **Date:** 2026-07-24
> **Objective:** Instalar y configurar los clientes de Supabase (Auth + Database) en Arcade Vault mediante `@supabase/supabase-js` y `@supabase/ssr`, dejando lista la infraestructura base de conexión para que specs futuros implementen autenticación real y persistencia de datos, sin migrar todavía ninguna feature existente.

## Scope

**In:**

- Instalación de `@supabase/supabase-js` y `@supabase/ssr` como dependencias (`npm install`).
- `lib/supabase/client.ts`: cliente de Supabase para Client Components (`createBrowserClient` de `@supabase/ssr`), usando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `lib/supabase/server.ts`: cliente de Supabase para Server Components/Server Actions (`createServerClient` de `@supabase/ssr`, asíncrono, leyendo cookies vía `next/headers`), mismas variables de entorno.
- `.env.example` ampliado (se mantienen las variables de Resend ya existentes) con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` vacías.
- Ruta de diagnóstico temporal `app/debug/supabase/page.tsx`: verifica en vivo que el cliente de servidor puede hablar con Supabase Auth (`supabase.auth.getSession()` o equivalente) y con la base de datos Postgres (una consulta trivial contra una tabla inexistente — un error `42P01`/"relation does not exist" prueba que la conexión y la API key funcionan, aunque todavía no haya tablas). Muestra "Auth: conectado" / "Database: conectado" o el error concreto si algo falla.
- Verificación manual: el usuario completa `.env.local` (gitignored) con la URL y anon key reales de su proyecto Supabase, y se confirma que `/debug/supabase` reporta ambas conexiones OK antes de cerrar el spec.
- Último paso del plan: eliminar `app/debug/supabase/page.tsx` una vez verificado, dejando el repo sin rutas de debug expuestas.

**Out of scope (para otro spec):**

- Migrar `av_user`/`localStorage` a Supabase Auth real (login, registro, logout, sesión) — sigue funcionando como hoy.
- Migrar `av_scores` a una tabla de Supabase — sigue en `localStorage` como hoy.
- Cualquier tabla, esquema o RLS en la base de datos — no se crea ninguna tabla en este spec.
- Mover el catálogo de juegos (`GAMES`, `PLAYERS`, `seededScores`) a la base de datos.
- Supabase CLI local ni carpeta `supabase/migrations/`.
- `middleware.ts` de refresco de sesión (se añade en el spec de Auth, cuando haya sesiones reales que refrescar).
- Arreglar la regla `.env*` de `.gitignore` (queda fuera, explícitamente decidido).
- Cualquier cambio visual o de comportamiento en páginas/componentes existentes (`nav.tsx`, `login`, `hall-of-fame`, `game-player.tsx`, etc.).

## Data model

Este spec no introduce estructuras de datos persistentes (no hay tablas ni esquema todavía). Sí define el contrato de los dos módulos cliente:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient;
// Client Components — usa NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>;
// Server Components / Server Actions — misma URL/anon key, cookies vía next/headers
```

```bash
# .env.example (se agrega a las variables de Resend ya existentes)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Convenciones:

- Ambos clientes exportan una función `createClient()` con la misma firma que documenta oficialmente Supabase para Next.js App Router (patrón de dos módulos: uno para browser, otro para server), para que el código futuro de Auth los importe sin ambigüedad sobre cuál usar en cada contexto.
- `.env.local` (gitignored, no se crea por este spec) es donde el usuario pone los valores reales antes de la verificación manual.

## Implementation plan

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install @supabase/supabase-js @supabase/ssr`). Test: `npm run dev` sigue levantando sin errores, sin ningún cambio de comportamiento todavía.
2. Ampliar `.env.example` agregando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` vacías, sin tocar las variables de Resend ya existentes.
3. Crear `lib/supabase/client.ts` con `createClient()` (vía `createBrowserClient` de `@supabase/ssr`), leyendo `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Test: `npm run build` compila sin errores de tipos (el módulo no se usa todavía, pero debe ser válido).
4. Crear `lib/supabase/server.ts` con `createClient()` asíncrono (vía `createServerClient` de `@supabase/ssr`, cookies desde `next/headers`). Antes de este paso, revisar `node_modules/next/dist/docs/01-app/` para confirmar la API vigente de `cookies()` en Next.js 16 (síncrona vs. asíncrona), ya que `@supabase/ssr` depende de ese contrato exacto. Test: `npm run build` sigue compilando sin errores.
5. Crear la ruta de diagnóstico temporal `app/debug/supabase/page.tsx` (Server Component): usa `lib/supabase/server.ts` para (a) llamar `supabase.auth.getSession()` y mostrar "Auth: conectado" o el error, y (b) hacer una consulta trivial contra una tabla inexistente y mostrar "Database: conectado" si el error recibido es `42P01` (relation does not exist) — cualquier otro error (API key inválida, red) se muestra tal cual. Ambas llamadas van envueltas en `try/catch` explícitos para no crashear la página. Test: `npm run dev` muestra `/debug/supabase` sin errores de consola (aunque sin `.env.local` real, la página debe mostrar el error de configuración de forma legible, no crashear).
6. **Paso manual (usuario):** completar `.env.local` con la URL y anon key reales del proyecto Supabase, reiniciar `npm run dev`, y confirmar en `/debug/supabase` que ambas líneas muestran "conectado".
7. Una vez confirmada la conexión, eliminar `app/debug/supabase/page.tsx` y correr `npm run build` como verificación final de que el repo queda limpio y sin errores.

## Acceptance criteria

- [ ] `@supabase/supabase-js` y `@supabase/ssr` aparecen en `dependencies` de `package.json`.
- [ ] `.env.example` incluye `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` vacías, junto a las variables de Resend ya existentes.
- [ ] `lib/supabase/client.ts` exporta `createClient()` y compila sin errores de tipos.
- [ ] `lib/supabase/server.ts` exporta un `createClient()` asíncrono que lee cookies vía `next/headers` y compila sin errores de tipos.
- [ ] Con `.env.local` real completado, `/debug/supabase` muestra "Auth: conectado" y "Database: conectado".
- [ ] Sin `.env.local` (o con valores inválidos), `/debug/supabase` muestra el error de forma legible en vez de crashear.
- [ ] `app/debug/supabase/page.tsx` ya no existe en el repo al cerrar el spec.
- [ ] `npm run build` termina sin errores como verificación final.
- [ ] Ninguna página o componente existente (`nav.tsx`, `login`, `hall-of-fame`, `game-player.tsx`, `auth-form`) cambia de comportamiento — `av_user`/`av_scores` en `localStorage` siguen funcionando exactamente igual que antes de este spec.

## Decisions

- **Yes:** integración real de Supabase (paquetes reales instalados, conexión real verificada), a diferencia del patrón mockeado del spec 03 (Resend). El usuario ya tiene un proyecto Supabase real y pidió explícitamente "implementar Supabase", no simularlo.
- **Yes:** instalar `@supabase/ssr` desde este spec de infraestructura, aunque todavía no exista ninguna feature de Auth. Evita retrabajo cuando llegue el spec de Auth, que dependerá de los mismos clientes browser/server.
- **No:** `middleware.ts` de refresco de sesión. Es infraestructura ligada directamente a sesiones de Auth reales, que no existen todavía — se añade junto con el spec de Auth.
- **No:** Supabase CLI local ni carpeta `supabase/migrations/`. Nos conectamos directo al proyecto cloud ya existente; sin tablas que versionar todavía, el CLI no aporta nada en este spec.
- **Yes:** ruta de diagnóstico temporal (`/debug/supabase`) para verificar Auth+DB, eliminada al final del spec. Da evidencia concreta de que la integración funciona sin dejar una superficie de debug expuesta permanentemente.
- **Yes:** verificar "Database: conectado" mediante el código de error `42P01` (tabla inexistente) en vez de crear una tabla de prueba. Prueba que la conexión y la API key llegan a Postgres sin necesitar ningún esquema, que está fuera de alcance de este spec.
- **No:** arreglar la regla `.env*` de `.gitignore` (que también ignora `.env.example`). Detectado durante la conversación, pero el usuario decidió explícitamente dejarlo fuera de este spec.
- **No:** tocar `av_user`/`av_scores` ni ninguna página/componente existente. Este spec es exclusivamente la "fontanería" de conexión; la migración de features reales a Supabase queda para specs futuros.

## Risks

| Risk                                                                                                                                                                                               | Mitigation                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La API de `cookies()`/`next/headers` en Next.js 16.2.10 podría diferir (síncrona vs. asíncrona, forma del objeto) de lo que espera `@supabase/ssr` según el conocimiento de entrenamiento.         | Paso 4 del plan revisa explícitamente `node_modules/next/dist/docs/01-app/` antes de escribir `lib/supabase/server.ts`.                                                                                                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` queda expuesta en el bundle del cliente (por el prefijo `NEXT_PUBLIC_`), lo cual podría parecer una fuga de credenciales.                                          | Es el diseño intencional de Supabase: la anon key es pública por definición y la seguridad real la da Row Level Security (RLS) en las tablas, no el secreto de la key. Se deja documentado aquí para que no se "corrija" por error en un spec futuro. |
| Si `.env.local` falta o tiene valores inválidos, una llamada de servidor sin manejo de errores podría tirar la página `/debug/supabase` completa (error 500) en vez de mostrar un mensaje legible. | Paso 5 envuelve las llamadas a Auth y Database en `try/catch` explícitos, y el criterio de aceptación correspondiente exige que el error se muestre en pantalla, no que la página crashee.                                                            |

## Lo que **no** está en este spec

- Migración de `av_user`/`av_scores` a Supabase (Auth y Database reales).
- Cualquier tabla, esquema o política de RLS.
- Catálogo de juegos en base de datos.
- Supabase CLI y migraciones versionadas.
- `middleware.ts` de refresco de sesión.
- Corrección de la regla `.env*` de `.gitignore`.

Cada uno de estos, si se implementa, va en su propio spec.

## Desviaciones al implementar

Dos detalles del texto literal del spec no coincidían con la realidad del proyecto/librería, confirmados en vivo contra el proyecto Supabase real durante la implementación:

- **Nombre de variable:** el proyecto real ya usa `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (el nombre vigente de Supabase para la anon key pública), no `NEXT_PUBLIC_SUPABASE_ANON_KEY` como decía el spec. `.env.example`/`.env.local` y ambos clientes (`lib/supabase/client.ts`, `lib/supabase/server.ts`) usan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Código de error de tabla inexistente:** `@supabase/supabase-js` habla con Postgres a través de PostgREST, que envuelve el error de tabla inexistente en su propio código `PGRST205` ("Could not find the table ... in the schema cache"), no en el código crudo de Postgres `42P01` que asumía el spec — ese código nunca llega a través del cliente JS. `app/debug/supabase/page.tsx` (ya eliminado) verificó "Database: conectado" comprobando `error.code === "PGRST205"`.

## Actualización posterior (2026-08-04, spec 23)

La decisión "No: Supabase CLI local ni carpeta `supabase/migrations/`" de este spec quedó **parcialmente revertida**: todo cambio de esquema se versiona ahora como una migración en `supabase/migrations/`, aplicada vía la tool MCP `apply_migration` — ver `specs/23-migracion-a-produccion.md`. El CLI en sí (`supabase link`/`db push`) sigue sin adoptarse; solo cambió el hecho de que el SQL deja de pegarse suelto en el SQL Editor sin dejar rastro versionado.
