import { processOrderConfirmed } from "@/lib/order-confirmation-server";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = body.order_id as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const svc = createServiceClient();
    const { error: upErr } = await svc
      .from("orders")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (upErr) {
      console.error("[admin confirm order]", upErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const result = await processOrderConfirmed(orderId);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
