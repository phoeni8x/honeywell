import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { notifyCustomerPush } from "@/lib/push-notify";
import { sanitizePlainText } from "@/lib/sanitize";
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
    const reasonRaw = typeof body.reason === "string" ? body.reason : "";
    const reason = sanitizePlainText(reasonRaw, 2000);

    if (!orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const svc = createServiceClient();
    const { data: order, error: fetchErr } = await svc
      .from("orders")
      .select("id, status, customer_token, order_number")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }

    if (order.status !== "payment_pending") {
      return NextResponse.json({ error: "Order is not pending approval.", code: "not_pending" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: upErr } = await svc
      .from("orders")
      .update({
        status: "cancelled",
        updated_at: now,
        rejection_reason: reason || null,
      })
      .eq("id", orderId)
      .eq("status", "payment_pending");

    if (upErr) {
      console.error("[admin reject order]", upErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const customerToken = order.customer_token as string | undefined;
    const orderNumber = (order.order_number as string | undefined) ?? orderId.slice(0, 8);
    if (customerToken) {
      void notifyCustomerPush(customerToken, {
        title: "Order update",
        body: reason
          ? `Order ${orderNumber} was not approved: ${reason.slice(0, 120)}`
          : `Order ${orderNumber} was not approved. Contact support if you have questions.`,
        url: "/home",
        tag: `reject-${orderId}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
