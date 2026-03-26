import { requireAdminUser } from "@/lib/admin-auth";
import { processOrderConfirmed } from "@/lib/order-confirmation-server";
import { notifyCustomerPush } from "@/lib/push-notify";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      order_id?: string;
      status?: "out_for_delivery" | "delivered";
    };
    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    const nextStatus = body.status;
    if (!orderId || (nextStatus !== "out_for_delivery" && nextStatus !== "delivered")) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const svc = createServiceClient();
    const { data: order, error: fetchErr } = await svc
      .from("orders")
      .select("id, status, fulfillment_type, customer_token, order_number")
      .eq("id", orderId)
      .maybeSingle();
    if (fetchErr || !order) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }
    if (order.fulfillment_type !== "delivery") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const allowedCurrent =
      nextStatus === "out_for_delivery"
        ? ["confirmed", "waiting"]
        : ["out_for_delivery", "confirmed", "waiting"];
    if (!allowedCurrent.includes(String(order.status))) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { error: updateErr } = await svc
      .from("orders")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (updateErr) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    let pointsEarned = 0;
    if (nextStatus === "delivered") {
      const result = await processOrderConfirmed(orderId);
      if (!result.ok) {
        return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
      }
      pointsEarned = Number(result.pointsEarned ?? 0);
    }

    const customerToken = typeof order.customer_token === "string" ? order.customer_token : "";
    if (customerToken) {
      const orderNum = (order.order_number as string | null) ?? orderId.slice(0, 8);
      void notifyCustomerPush(customerToken, {
        title: "Delivery update",
        body:
          nextStatus === "out_for_delivery"
            ? `Order ${orderNum} is now out for delivery.`
            : `Order ${orderNum} was marked delivered.`,
        url: `/account/orders/${orderId}/track`,
        tag: `delivery-status-${orderId}`,
      });
    }

    return NextResponse.json({ ok: true, points_earned: pointsEarned });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
