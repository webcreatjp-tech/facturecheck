"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface StatusPollerProps {
  /** Si true, le polling est actif (statut en attente/traitement). */
  active: boolean;
  /** Intervalle en millisecondes entre chaque rafraîchissement (défaut : 3000). */
  intervalMs?: number;
}

/**
 * Composant invisible qui rafraîchit automatiquement la page Server Component
 * tant que des uploads sont en cours de traitement (OCR, extraction, conformité).
 */
export default function StatusPoller({
  active,
  intervalMs = 3000,
}: StatusPollerProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, intervalMs, router]);

  return null;
}
