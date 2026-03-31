import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { notifyCustomerPush } from "@/lib/push-notify";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = await request.json();
    const orderId = body.order_id as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const svc = createServiceClient();
    const { data: ddId, error: rpcErr } = await svc.rpc("assign_dead_drop_for_order", {
      p_order_id: orderId,
    });

    if (rpcErr) {
      const msg = String(rpcErr.message ?? "").toLowerCase();
      if (msg.includes("dead_drop_unavailable")) {
        return NextResponse.json(
          { error: "No dead drop slot available right now. Add drops or retry.", code: "dead_drop_unavailable" },
          { status: 400 }
        );
      }
      if (msg.includes("not_awaiting_dead_drop") || msg.includes("not_dead_drop")) {
        return NextResponse.json({ error: "Order is not ready for dead-drop assignment.", code: "invalid_state" }, { status: 400 });
      }
      console.error("[assign_dead_drop_for_order]", rpcErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { data: order } = await svc
      .from("orders")
      .select("customer_token, order_number")
      .eq("id", orderId)
      .maybeSingle();

    const customerToken = order?.customer_token as string | undefined;
    if (customerToken) {
      void notifyCustomerPush(customerToken, {
        title: "Dead drop ready",
        body: "Open your order for photos, map link, and coordinates.",
        url: `/account/orders/${orderId}/track`,
        tag: `order-${orderId}-drop`,
      });
    }

    return NextResponse.json({ ok: true, order_id: orderId, dead_drop_id: ddId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
