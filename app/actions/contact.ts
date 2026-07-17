"use server";

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string; // "success" -> nombre del remitente; "error" -> mensaje de validación
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendContactMessage(
  _prevState: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const msg = String(formData.get("msg") || "").trim();

  if (!name || !email || !msg) {
    return { status: "error", message: "Todos los campos son obligatorios." };
  }

  await delay(600 + Math.random() * 300);

  // Aquí iría la llamada real a un proveedor de email (ej. Resend), usando
  // RESEND_API_KEY / CONTACT_TO_EMAIL / CONTACT_FROM_EMAIL de .env:
  //
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: process.env.CONTACT_FROM_EMAIL!,
  //   to: process.env.CONTACT_TO_EMAIL!,
  //   subject: `Nuevo mensaje de contacto de ${name}`,
  //   replyTo: email,
  //   text: msg,
  // });
  console.log(
    `[contact] Simulando envío de correo: name=${name} email=${email} msg=${JSON.stringify(msg)}`
  );

  return { status: "success", message: name };
}
