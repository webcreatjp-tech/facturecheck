import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase pour les Server Components et Server Actions.
 * Lit/écrit les cookies de session — respecte les politiques RLS
 * avec l'identité de l'utilisateur authentifié.
 *
 * À utiliser pour : vérifier l'auth, lire les données propres à l'user.
 * Pour les opérations en tant qu'admin, utiliser createSupabaseServerClient()
 * depuis src/lib/supabase.ts (service role).
 */
export async function createSupabaseSessionClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Dans un Server Component (lecture seule), les setAll
            // peuvent échouer silencieusement — le middleware s'en charge.
          }
        },
      },
    }
  );
}
