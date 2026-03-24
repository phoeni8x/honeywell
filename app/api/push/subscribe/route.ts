import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  try {
    const body = await request.json();
    const subscription = body.subscription as { endpoint?: string } | undefined;
    if (!subscription?.endpoint || typeof subscription !== "object") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        customer_token: token,
        subscription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_token" }
    );

    if (error) {
      console.error("[push subscribe]", error);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
