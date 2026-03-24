import { ADMIN_BASE_PATH } from "@/lib/constants";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_LOGIN_PATH = `${ADMIN_BASE_PATH}/login`;

/**
 * Admin is gated only by the obscured path. No login screen.
 * If ADMIN_EMAIL + ADMIN_PASSWORD are set, middleware signs into Supabase so RLS (authenticated) still works for the dashboard.
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  if (host === "teamruby.net") {
    const u = request.nextUrl.clone();
    u.hostname = "www.teamruby.net";
    return NextResponse.redirect(u, 308);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const path = request.nextUrl.pathname;

  const needsCustomerTokenParam = path === "/order-history" || path === "/pay/crypto";
  const hasOrderId = Boolean(request.nextUrl.searchParams.get("orderId")?.trim());
  if (needsCustomerTokenParam && !request.nextUrl.searchParams.get("ct")) {
    const cookieToken = request.cookies.get("honeywell_customer_token")?.value?.trim() ?? "";
    /** Do not append stale `ct` when linking to a specific order — client uses adopt-token instead. */
    if (cookieToken && !hasOrderId) {
      const u = request.nextUrl.clone();
      u.searchParams.set("ct", cookieToken);
      return NextResponse.redirect(u, 307);
    }
  }

  if (path === ADMIN_LOGIN_PATH || path.startsWith(`${ADMIN_LOGIN_PATH}/`)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ADMIN_BASE_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const isAdminUi = path.startsWith(ADMIN_BASE_PATH);
  const isAdminApi = path.startsWith("/api/admin");
  if (!isAdminUi && !isAdminApi) {
    return supabaseResponse;
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    /* Host redirect (apex → www) runs for all non-static paths; admin auth only when matched path is admin. */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
