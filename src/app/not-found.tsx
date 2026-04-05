import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <div className="rounded-2xl bg-blue-50 p-4">
            <FileQuestion className="h-10 w-10 text-blue-400" aria-hidden />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-gray-900">404</h1>
          <p className="mt-2 text-lg font-semibold text-gray-700">
            Page introuvable
          </p>
          <p className="mt-1 text-sm text-gray-500">
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Tableau de bord
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
