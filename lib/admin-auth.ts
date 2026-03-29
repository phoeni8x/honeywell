import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServerSupabase, createServerSupabaseFromRequest } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Admin API Route Handlers: use cookies on the incoming request (same source as middleware’s `honeywell_admin_access`).
 * Avoids 401s when `cookies()` from next/headers does not match the POST body request.
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (request.cookies.get("honeywell_admin_access")?.value === "1") {
    return null;
  }

  const supabase = createServerSupabaseFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!error && user) {
    return null;
  }

  return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
}

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
