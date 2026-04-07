import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { notifyAdminPush } from "@/lib/push-notify";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Customer marks collection without uploading a photo (same statuses as pickup-photo). */
export async function POST(request: Request) {
  try {
    const headerToken = getCustomerTokenFromRequest(request);
    const body = (await request.json().catch(() => null)) as { order_id?: unknown; customer_token?: unknown } | null;
    const bodyToken = typeof body?.customer_token === "string" ? body.customer_token.trim() : "";
    const customerToken = headerToken || bodyToken;
    const orderId = typeof body?.order_id === "string" ? body.order_id.trim() : "";

    if (!customerToken || !orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, customer_token, status, order_number")
      .eq("id", orderId)
      .single();

    if (orderErr || !order || order.customer_token !== customerToken) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }

    const allowed = new Set(["confirmed", "ready_for_pickup", "ready_at_drop"]);
    if (!allowed.has(String(order.status))) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { data: updatedRows, error: updErr } = await supabase
      .from("orders")
      .update({
        status: "pickup_submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .in("status", ["confirmed", "ready_for_pickup", "ready_at_drop"])
      .select("id");

    if (updErr) {
      console.error("[pickup-acknowledge update]", updErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }
    if (!updatedRows?.length) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 409 });
    }

    const ordNum = (order.order_number as string | undefined) ?? orderId.slice(0, 8);
    void notifyAdminPush({
      title: "Customer marked parcel collected",
      body: `Order ${ordNum}: customer confirmed collection (no photo).`,
      url: "/admin-080209?tab=orders",
      tag: `pickup-ack-${orderId}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
