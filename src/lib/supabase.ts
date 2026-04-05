import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur (service role).
 * À utiliser UNIQUEMENT dans les Server Actions / Route Handlers.
 * Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY côté client.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Variables d'environnement Supabase manquantes : " +
        "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
