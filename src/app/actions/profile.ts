"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseSessionClient } from "@/lib/supabase-server";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type ProfileActionResult =
  | { success: true }
  | { success: false; code: "unauthenticated" | "invalid_input" | "server_error"; message?: string };

// --------------------------------------------------------------------------
// updateEmail
// --------------------------------------------------------------------------

export async function updateEmail(newEmail: string): Promise<ProfileActionResult> {
  const email = newEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { success: false, code: "invalid_input", message: "Email invalide." };
  }

  const supabase = await createSupabaseSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, code: "unauthenticated" };

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    return { success: false, code: "server_error", message: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

// --------------------------------------------------------------------------
// updatePassword
// --------------------------------------------------------------------------

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<ProfileActionResult> {
  if (!newPassword || newPassword.length < 8) {
    return {
      success: false,
      code: "invalid_input",
      message: "Le mot de passe doit contenir au moins 8 caractères.",
    };
  }

  const supabase = await createSupabaseSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, code: "unauthenticated" };

  // Vérifier l'ancien mot de passe en se reconnectant
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });
  if (signInError) {
    return {
      success: false,
      code: "invalid_input",
      message: "Mot de passe actuel incorrect.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, code: "server_error", message: error.message };
  }

  return { success: true };
}
