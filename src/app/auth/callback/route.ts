import { createSupabaseSessionClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Route de callback OAuth / magic link / confirmation email.
 * Supabase redirige ici avec un `code` après confirmation.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // En cas d'erreur, rediriger vers la page de login avec un indicateur
  return NextResponse.redirect(
    `${origin}/auth/login?error=confirmation_failed`
  );
}
