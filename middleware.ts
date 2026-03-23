import { ADMIN_BASE_PATH } from "@/lib/constants";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_LOGIN_PATH = `${ADMIN_BASE_PATH}/login`;

/**
 * Admin is gated only by the obscured path. No login screen.
 * If ADMIN_EMAIL + ADMIN_PASSWORD are set, middleware signs into Supabase so RLS (authenticated) still works for the dashboard.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const path = request.nextUrl.pathname;

  if (path === ADMIN_LOGIN_PATH || path.startsWith(`${ADMIN_LOGIN_PATH}/`)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ADMIN_BASE_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  if (path.startsWith(ADMIN_BASE_PATH)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const email = process.env.ADMIN_EMAIL;
      const password = process.env.ADMIN_PASSWORD;
      if (email && password) {
        await supabase.auth.signInWithPassword({ email, password });
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin-080209", "/admin-080209/:path*"],
};
