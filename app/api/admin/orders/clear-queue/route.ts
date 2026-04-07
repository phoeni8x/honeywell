import { requireAdminUser } from "@/lib/admin-auth";
import { shouldRestoreProductStockOnPaymentPendingVoid } from "@/lib/order-payment-pending-helpers";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { notifyCustomerPush } from "@/lib/push-notify";
import { sanitizePlainText } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ClearKind = "payment_pending" | "booking";

/**
 * Bulk cancel orders in the admin approval queues (pending payment or booking requests).
 * Stock restore matches OrdersSection cancelOrder for payment_pending rows.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as { kind?: unknown; reason?: unknown } | null;
    const kind = body?.kind as ClearKind | undefined;
    const reasonRaw = typeof body?.reason === "string" ? body.reason : "";
    const reason = sanitizePlainText(reasonRaw, 2000);

    if (kind !== "payment_pending" && kind !== "booking") {
      return NextResponse.json({ error: "Invalid kind", code: "invalid_kind" }, { status: 400 });
    }

    const svc = createServiceClient();
    let q = svc
      .from("orders")
      .select(
        "id, status, customer_token, order_number, product_id, quantity, defer_stock_until_approval, payment_method, fulfillment_type"
      );

    if (kind === "payment_pending") {
      q = q.eq("status", "payment_pending");
    } else {
      q = q.eq("status", "pre_ordered").eq("payment_method", "booking");
    }

    const { data: rows, error: selErr } = await q.order("created_at", { ascending: true });

    if (selErr) {
      console.error("[clear-queue] select", selErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    const list = rows ?? [];
    if (list.length === 0) {
      return NextResponse.json({ ok: true, cleared: 0 });
    }

    if (kind === "payment_pending") {
      for (const order of list) {
        if (!shouldRestoreProductStockOnPaymentPendingVoid(order)) continue;
        const productId = order.product_id as string | null;
        const qty = Number(order.quantity ?? 0);
        if (!productId || qty <= 0) continue;
        const { error: rpcErr } = await svc.rpc("restore_product_stock", {
          p_product_id: productId,
          p_quantity: qty,
        });
        if (rpcErr) {
          console.error("[clear-queue] restore", order.id, rpcErr);
          return NextResponse.json(
            { error: "Could not restore stock for one of the orders. No orders were cancelled.", code: "stock_restore_failed" },
            { status: 400 }
          );
        }
      }
    }

    const ids = list.map((o) => o.id as string);
    const now = new Date().toISOString();
    const statusValues = kind === "booking" ? (["pre_ordered"] as const) : (["payment_pending"] as const);

    const { data: updatedRows, error: upErr } = await svc
      .from("orders")
      .update({
        status: "cancelled",
        updated_at: now,
        rejection_reason: reason || null,
      })
      .in("id", ids)
      .in("status", [...statusValues])
      .select("id, customer_token, order_number");

    if (upErr) {
      console.error("[clear-queue] bulk update", upErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    const cleared = updatedRows?.length ?? 0;

    for (const row of updatedRows ?? []) {
      const id = row.id as string;
      const customerToken = row.customer_token as string | undefined;
      const orderNumber = (row.order_number as string | undefined) ?? id.slice(0, 8);
      if (customerToken) {
        const title = kind === "booking" ? "Booking request declined" : "Order update";
        const bodyText =
          kind === "booking"
            ? reason
              ? `Booking ${orderNumber} was declined: ${reason.slice(0, 120)}`
              : `Booking ${orderNumber} was declined. Contact support if you have questions.`
            : reason
              ? `Order ${orderNumber} was not approved: ${reason.slice(0, 120)}`
              : `Order ${orderNumber} was not approved. Contact support if you have questions.`;
        void notifyCustomerPush(customerToken, {
          title,
          body: bodyText,
          url: "/home",
          tag: `bulk-reject-${kind}-${id}`,
        });
      }
    }

    return NextResponse.json({ ok: true, cleared });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
