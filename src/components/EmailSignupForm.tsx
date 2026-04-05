"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerWaitlistEmail, WaitlistError } from "@/lib/api";
import type { WaitlistSource } from "@/app/actions/waitlist";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type FormState = "idle" | "loading" | "success" | "error";

interface EmailSignupFormProps {
  /** Zone d'origine du formulaire, transmise à la base de données. */
  source: WaitlistSource;
}

// --------------------------------------------------------------------------
// Composant
// --------------------------------------------------------------------------

export default function EmailSignupForm({ source }: EmailSignupFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const inputId = `signup-email-${source}`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;

    setState("loading");
    setErrorMsg("");

    try {
      await registerWaitlistEmail(email, source);
      setState("success");
      setEmail("");
    } catch (err) {
      setState("error");
      setErrorMsg(
        err instanceof WaitlistError
          ? err.message
          : "Une erreur est survenue. Veuillez réessayer."
      );
    }
  }

  if (state === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl bg-green-50 border border-green-200 px-6 py-4 text-green-700 text-sm font-medium text-center"
      >
        Parfait&nbsp;! Vérifiez votre boîte mail pour confirmer votre
        inscription.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Formulaire d'inscription"
      className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto"
    >
      <label htmlFor={inputId} className="sr-only">
        Adresse email
      </label>
      <Input
        id={inputId}
        type="email"
        required
        placeholder="votre@email.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === "loading"}
        aria-describedby={state === "error" ? `${inputId}-error` : undefined}
        className="flex-1"
      />
      <Button
        type="submit"
        size="default"
        disabled={state === "loading"}
        className="shrink-0"
      >
        {state === "loading" ? "Envoi…" : "Essai gratuit"}
      </Button>
      {state === "error" && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-red-600 text-xs mt-1 w-full"
        >
          {errorMsg}
        </p>
      )}
    </form>
  );
}
