/**
 * Registers an email for the waitlist.
 * TODO: replace with real Supabase call.
 */
export async function registerWaitlistEmail(email: string): Promise<void> {
  // Simulated network delay – swap out for Supabase Auth / DB insert
  await new Promise<void>((resolve) => setTimeout(resolve, 800));
  void email;
}
