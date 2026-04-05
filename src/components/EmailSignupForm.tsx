"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerWaitlistEmail } from "@/lib/api";

type FormState = "idle" | "loading" | "success" | "error";

export default function EmailSignupForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;

    setState("loading");
    setErrorMsg("");

    try {
      await registerWaitlistEmail(email);
      setState("success");
      setEmail("");
    } catch {
      setState("error");
      setErrorMsg("Une erreur est survenue. Veuillez réessayer.");
    }
  }

  if (state === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl bg-green-50 border border-green-200 px-6 py-4 text-green-700 text-sm font-medium text-center"
      >
        Parfait ! Vérifiez votre boîte mail pour confirmer votre inscription.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Formulaire d'inscription"
      className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto"
    >
      <label htmlFor="signup-email" className="sr-only">
        Adresse email
      </label>
      <Input
        id="signup-email"
        type="email"
        required
        placeholder="votre@email.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === "loading"}
        aria-describedby={state === "error" ? "signup-error" : undefined}
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
        <p id="signup-error" role="alert" className="text-red-600 text-xs mt-1">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
