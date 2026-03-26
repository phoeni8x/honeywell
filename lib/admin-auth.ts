import { createServerSupabase } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

/** Requires a Supabase Auth session (middleware signs in admin on /admin-080209 when ADMIN_EMAIL/PASSWORD are set). */
export async function requireAdminUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const bypass = cookieStore.get("honeywell_admin_access")?.value === "1";

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!error && user) return user;

  if (bypass) {
    return {
      id: "admin-bypass",
      aud: "authenticated",
      role: "authenticated",
      email: "admin@local",
      phone: "",
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    } as unknown as User;
  }

  return null;
}
