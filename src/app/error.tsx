"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <div className="rounded-2xl bg-red-50 p-4">
            <AlertTriangle className="h-10 w-10 text-red-400" aria-hidden />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Une erreur est survenue
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Quelque chose s&apos;est mal passé. Vous pouvez réessayer ou
            revenir au tableau de bord.
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-gray-400 font-mono">
              Ref : {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Réessayer
          </button>
          <a
            href="/dashboard"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Tableau de bord
          </a>
        </div>
      </div>
    </div>
  );
}
