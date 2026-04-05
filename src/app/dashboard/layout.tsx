import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "@/lib/supabase-server";
import { getOrCreateProfile } from "@/lib/billing";
import LogoutButton from "@/components/LogoutButton";
import PlanBadge from "@/components/PlanBadge";
import Link from "next/link";
import { User } from "lucide-react";

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

  const profile = await getOrCreateProfile(user.id);
  const planStatus = profile?.subscription_status ?? "free";

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

          <div className="flex items-center gap-3 min-w-0">
            <span
              className="hidden sm:block text-sm text-gray-500 truncate max-w-xs"
              title={user.email}
            >
              {user.email}
            </span>
            <PlanBadge status={planStatus} />
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Mon profil"
              aria-label="Mon profil"
            >
              <User className="h-4 w-4" aria-hidden />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* ── Contenu ── */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10">{children}</main>
    </div>
  );
}
