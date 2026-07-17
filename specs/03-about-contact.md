# SPEC 03 — Acerca de + formulario de contacto

> **Status:** Implemented
> **Depends on:** 01-mvp-visual, 02-home-landing
> **Date:** 2026-07-17
> **Objective:** Añadir la página "Acerca de" (con formulario de contacto) del template `home-about` como nueva ruta `/about` de Arcade Vault, con envío de correo simulado mediante una Server Action pensada para integrarse después con Resend.

## Scope

**In:**

- Nueva página en `/about` (puerto de `about.jsx`): hero "Acerca de" con misión y highlight-row (3 tarjetas con icono, `HEART`/`BROWSER`/`PLANT`), divider decorativo animado, sección de contacto con intro (tips) y formulario (nombre, correo, mensaje).
- `components/nav.tsx` actualizado: nuevo link "Acerca de" → `/about`, agregado después de "Salón de la Fama" y antes del contador de créditos/botón de sesión (mismo orden que `nav.jsx`), tanto en el nav de escritorio como en el menú móvil. Nueva lógica `isAbout` = `pathname === "/about"`.
- Formulario de contacto como client component (`components/about-contact-form.tsx`), usando `<form action={...}>` nativo de React 19 con `useActionState`, validación mínima igual que el template (shake si algún campo está vacío, sin regex de email).
- Server Action `app/actions/contact.ts` (`"use server"`): repite la validación de "no vacío", simula latencia (600–900ms) y siempre responde éxito. Hace `console.log` del payload como si fuera el log de un proveedor de email; no persiste nada. Comentarios explícitos señalando la línea exacta donde iría la llamada real al SDK de Resend (`resend.emails.send(...)`).
- Estado de carga: mientras la Server Action está en curso, el botón de envío se deshabilita y muestra "ENVIANDO…" (vía `useFormStatus`/estado pendiente de `useActionState`).
- Estado de éxito: terminal simulada (`terminal-success`, líneas `[OK] Conectando…` etc.) igual que el template, mostrada tras la respuesta de la Server Action.
- `.env.example` en la raíz del proyecto con variables placeholder (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`), sin instalar el paquete `resend` ni hacer ninguna llamada real.
- Animación reveal-on-scroll (`IntersectionObserver`, clases `.reveal`/`.in`) para el divider y la sección de contacto, igual que el resto del sitio.
- Ampliación de `app/globals.css` con la sección `ABOUT PAGE` de `styles.css` (`.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`/`.highlight`, `.about-divider`, `.about-contact`, `.contact-grid`, `.contact-form`, `.terminal-success`, etc.), reutilizada tal cual.

**Out of scope (para otro spec):**

- Envío real de correo (integración real con Resend u otro proveedor, instalación del SDK, llamada de red real). Este spec deja el código y las variables de entorno pensadas para esa integración, pero no la implementa.
- Simulación de fallo en el envío (la Server Action siempre responde éxito en este spec).
- Persistencia del mensaje enviado (localStorage, base de datos o cualquier historial de mensajes).
- Validación de formato de email (regex) o límites de longitud del mensaje — se mantiene la validación mínima del template (campos no vacíos).
- Rate limiting o protección anti-spam del formulario.
- Internacionalización (el contenido sigue en español).
- Tests automatizados.

## Data model

Este spec no introduce estructuras de datos persistentes (no hay `localStorage` nuevo). Sí define un contrato de tipos para la Server Action:

```ts
// app/actions/contact.ts
export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string; // nombre del remitente, usado en el mensaje de éxito
};

export async function sendContactMessage(
  prevState: ContactState,
  formData: FormData
): Promise<ContactState>;
```

```bash
# .env.example
RESEND_API_KEY=
CONTACT_TO_EMAIL=team@arcadevault.example
CONTACT_FROM_EMAIL=noreply@arcadevault.example
```

Conventions:

- `FormData` trae los campos `name`, `email`, `msg` (mismos nombres que el `state` del formulario en el template).
- Las variables de `.env.example` no se leen todavía en ningún lado ejecutable — son documentación de lo que la integración real con Resend necesitaría (`RESEND_API_KEY` para el SDK, `CONTACT_TO_EMAIL`/`CONTACT_FROM_EMAIL` para los headers del correo).

## Implementation plan

1. Crear `app/actions/contact.ts` con la Server Action `sendContactMessage` (`"use server"`): valida que `name`/`email`/`msg` no estén vacíos, simula latencia (600–900ms), hace `console.log` del payload y responde `{ status: "success", message: name }`. Incluye comentario señalando la línea exacta donde iría `resend.emails.send(...)`. No se toca ningún componente todavía; `npm run dev` sigue funcionando igual.
2. Crear `.env.example` con `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` vacíos/de ejemplo.
3. Ampliar `app/globals.css` con la sección "ABOUT PAGE" de `styles.css` (`.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`/`.highlight`, `.about-divider`, `.about-contact`, `.contact-grid`, `.contact-form`, `.terminal-success`, etc.). `npm run dev` sigue mostrando el sitio actual sin errores.
4. Crear `components/about-contact-form.tsx` (client component): campos nombre/correo/mensaje, `useActionState(sendContactMessage, { status: "idle" })`, shake si algún campo está vacío antes de invocar la acción, botón deshabilitado con "ENVIANDO…" mientras está pendiente, y terminal de éxito (`terminal-success`) cuando `status === "success"`, con botón "ENVIAR OTRO MENSAJE" que resetea el estado.
5. Crear `app/about/page.tsx` (client component, por el reveal-on-scroll) — puerto de `about.jsx`: hero con kicker/misión y `highlight-row` (`HighlightIcon` para `HEART`/`BROWSER`/`PLANT`), divider animado, sección de contacto con intro/tips y `<AboutContactForm />`. Test manual: `/about` muestra la página completa sin errores de consola; enviar el formulario vacío hace shake; completarlo y enviarlo muestra "ENVIANDO…" y luego la terminal de éxito con el nombre ingresado.
6. Actualizar `components/nav.tsx`: agregar el link "Acerca de" → `/about` (escritorio y menú móvil), en la posición después de "Salón de la Fama", con la lógica `isAbout = pathname === "/about"`. Test manual: desde cualquier ruta el link "Acerca de" aparece, navega a `/about` y se resalta como activo ahí.
7. Repaso final de fidelidad visual y responsive: recorrer `/about` en escritorio y en un viewport móvil, comparar contra el template de referencia y ajustar cualquier detalle de CSS que falte (highlight-row, contact-grid, terminal-success). Usa Playwright para esto.

## Acceptance criteria

- [X] `npm run dev` levanta sin errores en consola en `/about`.
- [X] `/about` muestra el hero "Acerca de" con la misión y las 3 tarjetas de `highlight-row` (iconos HEART/BROWSER/PLANT).
- [X] El divider decorativo se anima al hacer scroll hasta él (clase `.reveal`/`.in`).
- [X] La sección de contacto muestra la intro con los 3 tips y el formulario (nombre, correo, mensaje).
- [X] Enviar el formulario con algún campo vacío dispara la animación de shake y no invoca la Server Action.
- [X] Enviar el formulario completo deshabilita el botón y muestra "ENVIANDO…" mientras la Server Action está en curso.
- [X] Tras la respuesta exitosa, se muestra la terminal de éxito con el nombre ingresado en mayúsculas.
- [X] El botón "ENVIAR OTRO MENSAJE" de la terminal de éxito vuelve a mostrar el formulario vacío.
- [X] La Server Action (`app/actions/contact.ts`) hace `console.log` del payload recibido; no hay ninguna llamada de red saliente real.
- [X] `.env.example` existe en la raíz con `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL`.
- [X] El Nav muestra el link "Acerca de" → `/about`, después de "Salón de la Fama", tanto en escritorio como en el menú móvil.
- [X] El link "Acerca de" se resalta como activo cuando la ruta actual es `/about`.
- [X] En un viewport móvil (< 840px), `/about` es legible/usable (highlight-row y contact-grid colapsan a columna según el CSS del template) y el link "Acerca de" funciona en el menú hamburguesa.

## Decisions

- **Yes:** Server Action (`app/actions/contact.ts`) como mecanismo de simulación de envío, en vez de un manejador puramente de cliente. Deja un punto de integración real de servidor (donde iría el SDK de Resend) ya construido, en vez de tener que introducirlo después.
- **No:** simulación puramente en cliente (`setTimeout` dentro del componente, como hace `about.jsx`). Perdería el punto de integración de servidor que el usuario pidió explícitamente dejar pensado.
- **Yes:** la Server Action siempre responde éxito (sin fallo simulado). Más simple y fiel al comportamiento del template original; el manejo de error es una extensión natural para cuando se integre el proveedor real.
- **No:** fallo aleatorio simulado. Añadiría un estado de error sin caso de uso real todavía en este spec.
- **Yes:** `<form action={...}>` nativo de React 19 con `useActionState`, en vez de `onSubmit` + estado controlado manual. Es el patrón idiomático de Server Actions en Next.js 16 / React 19, con progressive enhancement incluido.
- **Yes:** estado de carga ("ENVIANDO…") explícito durante la Server Action, aunque el template original no lo tiene. Refleja honestamente que ahora hay una llamada de red simulada con latencia, no una respuesta síncrona.
- **Yes:** `.env.example` con variables placeholder de Resend (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`), sin instalar el SDK. Documenta la integración futura de forma concreta sin comprometerse a implementarla ahora.
- **No:** instalar el paquete `resend` o hacer cualquier llamada real de red. Fuera de alcance — el envío sigue siendo simulado en este spec.
- **Yes:** validación mínima (campos no vacíos) duplicada en cliente y en la Server Action, sin regex de email ni límites de longitud. Consistente con el template original; nunca confiar solo en la validación de cliente para una Server Action.
- **No:** persistir el mensaje enviado (localStorage o similar). Es una simulación de envío de correo, no un buzón de mensajes; no hay caso de uso real para consultarlos después dentro de este spec.
- **Yes:** agregar el link "Acerca de" al Nav en este mismo spec, a diferencia de spec 02 que lo dejó fuera deliberadamente. Ahora la ruta `/about` sí existe, así que el link deja de ser un link muerto.
- **Yes:** reutilizar tal cual las clases CSS del template (`app/globals.css`) para la sección "ABOUT PAGE", consistente con la decisión ya tomada en specs 01 y 02 de priorizar fidelidad visual exacta.

## Risks

| Risk | Mitigation |
| --- | --- |
| Next.js 16.2.10 / React 19 podrían diferir de las APIs de Server Actions y `useActionState` conocidas por entrenamiento (firma exacta, ubicación de `"use server"`, comportamiento de `useFormStatus`). | Antes del paso 1, revisar `node_modules/next/dist/docs/01-app/` (Server Actions y Data Fetching) para confirmar la API correcta en esta versión. |
| Si la Server Action se declara dentro del mismo archivo que un client component, Next.js podría requerir separarla en su propio módulo con `"use server"` en la primera línea. | `app/actions/contact.ts` se crea como archivo dedicado desde el inicio (paso 1), evitando mezclarla con componentes cliente. |
| El reveal-on-scroll de `/about` usa `IntersectionObserver` en un `useEffect`, igual que Home (spec 02); si se aplica visibilidad inicial vía estilo inline en vez de la clase `.reveal`, puede causar desajuste de hidratación. | Aplicar el estado inicial oculto únicamente vía la clase CSS `.reveal`, nunca con estilos inline calculados en el render inicial, igual que en Home. |

## Lo que **no** está en este spec

- Envío real de correo (integración real con Resend, instalación del SDK, llamada de red real).
- Simulación de fallo en el envío del formulario.
- Persistencia del mensaje enviado (localStorage, base de datos o historial).
- Validación de formato de email o límites de longitud del mensaje.
- Rate limiting o protección anti-spam del formulario.
- Internacionalización (i18n).
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
