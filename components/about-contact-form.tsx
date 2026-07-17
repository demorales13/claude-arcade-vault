"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendContactMessage, type ContactState } from "@/app/actions/contact";

const initialState: ContactState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn xl press" type="submit" style={{ width: "100%" }} disabled={pending}>
      {pending ? "▶  ENVIANDO…" : "▶  ENVIAR MENSAJE"}
    </button>
  );
}

export function AboutContactForm() {
  const [state, formAction] = useActionState(sendContactMessage, initialState);
  const [shake, setShake] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") setShowSuccess(true);
  }, [state]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const msg = String(data.get("msg") || "").trim();
    if (!name || !email || !msg) {
      e.preventDefault();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const handleReset = () => {
    formRef.current?.reset();
    setShowSuccess(false);
  };

  if (showSuccess) {
    return (
      <div className="terminal-success">
        <div className="term-bar">
          <span className="dot r"></span>
          <span className="dot y"></span>
          <span className="dot g"></span>
          <span className="term-title">VAULT-OS // TERMINAL</span>
        </div>
        <div className="term-body">
          <div className="line">
            <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
          </div>
          <div className="line dim">[OK] Conectando con servidor…</div>
          <div className="line dim">[OK] Validando contenido…</div>
          <div className="line dim">[OK] Transmitiendo paquete…</div>
          <div className="line success">
            &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {state.message?.toUpperCase()}.
            <span className="caret">_</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn ghost" type="button" onClick={handleReset}>
              ENVIAR OTRO MENSAJE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className={"contact-form" + (shake ? " shake" : "")}
      action={formAction}
      onSubmit={handleSubmit}
    >
      <div className="field">
        <label>NOMBRE</label>
        <input name="name" placeholder="px_kai" />
      </div>
      <div className="field">
        <label>CORREO ELECTRÓNICO</label>
        <input type="email" name="email" placeholder="jugador@vault.gg" />
      </div>
      <div className="field">
        <label>MENSAJE</label>
        <textarea rows={5} name="msg" placeholder="Cuéntanos qué tienes en mente…"></textarea>
      </div>
      {state.status === "error" && (
        <p style={{ color: "var(--ink-dim)", fontSize: 12, marginTop: -8, marginBottom: 12 }}>
          {state.message}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
