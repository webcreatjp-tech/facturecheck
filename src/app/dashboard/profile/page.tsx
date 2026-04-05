"use client";

import { useState, useTransition } from "react";
import { User, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateEmail, updatePassword } from "@/app/actions/profile";

export default function ProfilePage() {
  const [emailPending, startEmailTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();

  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    startEmailTransition(async () => {
      const result = await updateEmail(newEmail);
      if (result.success) {
        setEmailMsg({ ok: true, text: "Un email de confirmation a été envoyé à votre nouvelle adresse." });
        setNewEmail("");
      } else {
        setEmailMsg({ ok: false, text: result.message ?? "Une erreur est survenue." });
      }
    });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "Les mots de passe ne correspondent pas." });
      return;
    }
    startPasswordTransition(async () => {
      const result = await updatePassword(currentPw, newPw);
      if (result.success) {
        setPwMsg({ ok: true, text: "Mot de passe mis à jour avec succès." });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        setPwMsg({ ok: false, text: result.message ?? "Une erreur est survenue." });
      }
    });
  }

  return (
    <div className="space-y-10 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gérez votre adresse email et votre mot de passe.
        </p>
      </div>

      {/* ── Changer l'email ── */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-500" aria-hidden />
          <h2 className="text-base font-semibold text-gray-900">
            Adresse email
          </h2>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="nouvelle@email.fr"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            aria-label="Nouvelle adresse email"
          />
          {emailMsg && (
            <p
              className={`flex items-center gap-2 text-sm ${
                emailMsg.ok ? "text-green-600" : "text-red-600"
              }`}
            >
              {emailMsg.ok ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {emailMsg.text}
            </p>
          )}
          <Button type="submit" disabled={emailPending}>
            {emailPending ? "Mise à jour…" : "Changer l'email"}
          </Button>
        </form>
      </section>

      {/* ── Changer le mot de passe ── */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-blue-500" aria-hidden />
          <h2 className="text-base font-semibold text-gray-900">
            Mot de passe
          </h2>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Mot de passe actuel"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
            aria-label="Mot de passe actuel"
          />
          <Input
            type="password"
            placeholder="Nouveau mot de passe (min. 8 caractères)"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={8}
            aria-label="Nouveau mot de passe"
          />
          <Input
            type="password"
            placeholder="Confirmer le nouveau mot de passe"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            aria-label="Confirmer le nouveau mot de passe"
          />
          {pwMsg && (
            <p
              className={`flex items-center gap-2 text-sm ${
                pwMsg.ok ? "text-green-600" : "text-red-600"
              }`}
            >
              {pwMsg.ok ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {pwMsg.text}
            </p>
          )}
          <Button type="submit" disabled={passwordPending}>
            {passwordPending ? "Mise à jour…" : "Changer le mot de passe"}
          </Button>
        </form>
      </section>
    </div>
  );
}
