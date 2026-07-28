"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendContactMessage, type ContactState } from "@/app/actions/contact";
import { useLanguage } from "@/lib/i18n/language-context";

const initialState: ContactState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  const { dict } = useLanguage();
  return (
    <button
      className="btn xl press"
      type="submit"
      style={{ width: "100%" }}
      disabled={pending}
    >
      {pending ? dict.contactForm.submitPending : dict.contactForm.submitIdle}
    </button>
  );
}

export function AboutContactForm() {
  const [state, formAction] = useActionState(sendContactMessage, initialState);
  const { dict } = useLanguage();
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
            <span className="prompt">vault@arcade:~$</span> ./send_message
            --to=team
          </div>
          <div className="line dim">{dict.contactForm.successConnecting}</div>
          <div className="line dim">{dict.contactForm.successValidating}</div>
          <div className="line dim">{dict.contactForm.successTransmitting}</div>
          <div className="line success">
            &gt; {dict.contactForm.successMessagePrefix}{" "}
            {state.message?.toUpperCase()}.<span className="caret">_</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn ghost" type="button" onClick={handleReset}>
              {dict.contactForm.successButton}
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
        <label>{dict.contactForm.fieldName}</label>
        <input name="name" placeholder={dict.contactForm.namePlaceholder} />
      </div>
      <div className="field">
        <label>{dict.contactForm.fieldEmail}</label>
        <input
          type="email"
          name="email"
          placeholder={dict.contactForm.emailPlaceholder}
        />
      </div>
      <div className="field">
        <label>{dict.contactForm.fieldMessage}</label>
        <textarea
          rows={5}
          name="msg"
          placeholder={dict.contactForm.msgPlaceholder}
        ></textarea>
      </div>
      {state.status === "error" && (
        <p
          style={{
            color: "var(--ink-dim)",
            fontSize: 12,
            marginTop: -8,
            marginBottom: 12,
          }}
        >
          {state.message}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
