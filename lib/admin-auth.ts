import { createServerSupabase } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Requires a Supabase Auth session (middleware signs in admin on /admin-080209 when ADMIN_EMAIL/PASSWORD are set). */
export async function requireAdminUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
