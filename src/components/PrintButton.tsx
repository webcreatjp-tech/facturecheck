"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors print:hidden"
      aria-label="Imprimer ou exporter en PDF"
    >
      <Printer className="h-4 w-4" aria-hidden />
      Exporter PDF
    </button>
  );
}
