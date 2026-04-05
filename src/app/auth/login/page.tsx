"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "signin" | "signup";
type AuthState = "idle" | "loading" | "error";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Pré-remplir l'email s'il vient de la liste d'attente (future intégration)
  useEffect(() => {
    const preEmail = searchParams.get("email");
    if (preEmail) setEmail(decodeURIComponent(preEmail));
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthState("loading");
    setErrorMsg("");
    setSuccessMsg("");

    const supabase = createSupabaseBrowserClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) {
        setAuthState("error");
        setErrorMsg(translateAuthError(error.message));
        return;
      }

      setAuthState("idle");
      setSuccessMsg(
        "Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse."
      );
      return;
    }

    // Sign in
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthState("error");
      setErrorMsg(translateAuthError(error.message));
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <a href="/" className="mb-8 text-2xl font-bold text-blue-600 tracking-tight">
        FactureCheck
      </a>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Mode d'authentification"
          className="flex rounded-xl bg-gray-100 p-1 mb-6 gap-1"
        >
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {m === "signin" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>

        {/* Succès inscription */}
        {successMsg && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm"
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-label="Formulaire d'authentification">
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Adresse email
              </label>
              <Input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                placeholder="votre@email.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={authState === "loading"}
                aria-describedby={authState === "error" ? "auth-error" : undefined}
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Mot de passe
              </label>
              <Input
                id="auth-password"
                type="password"
                required
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                placeholder={mode === "signup" ? "8 caractères minimum" : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={authState === "loading"}
                minLength={mode === "signup" ? 8 : undefined}
              />
            </div>
          </div>

          {/* Erreur */}
          {authState === "error" && (
            <p
              id="auth-error"
              role="alert"
              className="mt-3 text-sm text-red-600"
            >
              {errorMsg}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={authState === "loading"}
            className="w-full mt-6"
          >
            {authState === "loading"
              ? "Chargement…"
              : mode === "signin"
              ? "Se connecter"
              : "Créer mon compte"}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        © {new Date().getFullYear()} FactureCheck
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------
// Traduction des erreurs Supabase Auth en français
// --------------------------------------------------------------------------
function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "Email ou mot de passe incorrect.";
  }
  if (/email already registered/i.test(message) || /already been registered/i.test(message)) {
    return "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.";
  }
  if (/password should be at least/i.test(message)) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Email non confirmé. Vérifiez votre boîte mail.";
  }
  if (/rate limit/i.test(message)) {
    return "Trop de tentatives. Veuillez patienter quelques minutes.";
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}
