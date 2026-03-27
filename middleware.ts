import { ADMIN_BASE_PATH } from "@/lib/constants";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_LOGIN_PATH = `${ADMIN_BASE_PATH}/login`;
const DEMO_BASE_PATH = "/demo-080209";

async function isMaintenanceMode(request: NextRequest): Promise<boolean> {
  try {
    const url = request.nextUrl.clone();
    url.pathname = "/api/public/maintenance";
    url.search = "";
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: { "x-maintenance-probe": "1" },
    });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => ({}))) as { maintenance_mode?: boolean };
    return Boolean(json.maintenance_mode);
  } catch {
    return false;
  }
}

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
  const isDemoUi = path === DEMO_BASE_PATH || path.startsWith(`${DEMO_BASE_PATH}/`);
  const demoInternalPath = isDemoUi ? path.slice(DEMO_BASE_PATH.length) || "/" : path;
  const isAdminUi = path.startsWith(ADMIN_BASE_PATH);
  const isAdminApi = path.startsWith("/api/admin");
  const isMaintenanceApi = path.startsWith("/api/public/maintenance");
  const isUnderDevelopmentPage = path === "/under-development";
  const isTelegramWebhook = path.startsWith("/api/telegram/webhook");

  const maintenanceGateEnabled = true;
  if (maintenanceGateEnabled && !isMaintenanceApi) {
    const maintenanceOn = await isMaintenanceMode(request);
    if (maintenanceOn && !isAdminUi && !isAdminApi && !isUnderDevelopmentPage && !isTelegramWebhook && !isDemoUi) {
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Website under development. Please check back later." },
          { status: 503 }
        );
      }
      const u = request.nextUrl.clone();
      u.pathname = "/under-development";
      u.search = "";
      return NextResponse.rewrite(u);
    }
  }

  const needsCustomerTokenParam = demoInternalPath === "/order-history" || demoInternalPath === "/pay/crypto";
  const hasOrderId = Boolean(request.nextUrl.searchParams.get("orderId")?.trim());
  if (needsCustomerTokenParam && !request.nextUrl.searchParams.get("ct")) {
    const cookieToken = request.cookies.get("honeywell_customer_token")?.value?.trim() ?? "";
    /** Do not append stale `ct` when linking to a specific order — client uses adopt-token instead. */
    if (cookieToken && cookieToken.length >= 8 && !hasOrderId) {
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

  if (isDemoUi) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = demoInternalPath === "/" ? "/home" : demoInternalPath;
    return NextResponse.rewrite(rewriteUrl);
  }

  if (!isAdminUi && !isAdminApi) {
    return supabaseResponse;
  }

  // Obscured admin path is the primary gate in this project.
  // Set an admin-access cookie so /api/admin routes can verify the same browser session
  // even if Supabase auth session cookies are not durable on every request.
  supabaseResponse.cookies.set("honeywell_admin_access", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

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
