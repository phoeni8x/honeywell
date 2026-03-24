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
    const { data: order, error: fetchErr } = await svc.from("orders").select("*").eq("id", orderId).maybeSingle();

    if (fetchErr || !order) {
      console.error("[admin confirm order] fetch", fetchErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    if (order.status !== "payment_pending") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const isRevolutDeliveryPayNow =
      order.payment_method === "revolut" &&
      order.fulfillment_type === "delivery" &&
      order.revolut_pay_timing === "pay_now";

    const now = new Date().toISOString();

    if (isRevolutDeliveryPayNow) {
      const { error: upErr } = await svc
        .from("orders")
        .update({
          status: "waiting",
          pay_now_payment_confirmed: true,
          updated_at: now,
        })
        .eq("id", orderId)
        .eq("status", "payment_pending");

      if (upErr) {
        console.error("[admin confirm order]", upErr);
        return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
      }
    } else {
      const { error: upErr } = await svc
        .from("orders")
        .update({ status: "confirmed", updated_at: now })
        .eq("id", orderId)
        .eq("status", "payment_pending");

      if (upErr) {
        console.error("[admin confirm order]", upErr);
        return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
      }
    }

    const result = await processOrderConfirmed(orderId);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
