import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { order_id?: string };
    const orderId = typeof body?.order_id === "string" ? body.order_id.trim() : "";
    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("orders")
      .select("customer_token")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !data?.customer_token) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }

    const host = request.headers.get("host")?.split(":")[0] ?? "";
    const secure = request.headers.get("x-forwarded-proto") === "https" || host !== "localhost";
    const cookieDomain = host.endsWith("teamruby.net") ? ".teamruby.net" : undefined;

    const res = NextResponse.json({ ok: true, customer_token: data.customer_token });
    res.cookies.set("honeywell_customer_token", data.customer_token, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure,
      maxAge: 60 * 60 * 24 * 400,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return res;
  } catch {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}

