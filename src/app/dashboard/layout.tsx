import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "@/lib/supabase-server";
import LogoutButton from "@/components/LogoutButton";

export const metadata = {
  title: "Tableau de bord – FactureCheck",
  description: "Gérez et analysez vos factures électroniques.",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Filet de sécurité côté serveur (le middleware protège déjà la route)
  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="/"
            className="text-xl font-bold text-blue-600 tracking-tight shrink-0"
          >
            FactureCheck
          </a>

          <div className="flex items-center gap-4 min-w-0">
            <span
              className="hidden sm:block text-sm text-gray-500 truncate max-w-xs"
              title={user.email}
            >
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* ── Contenu ── */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">{children}</main>
    </div>
  );
}
