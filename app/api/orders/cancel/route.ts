import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Customer cancels own order (restores stock). Blocked for pay-now Revolut after admin confirmed payment. */
export async function POST(request: Request) {
  try {
    const token = getCustomerTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = await request.json();
    const orderId = body.order_id as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("customer_token", token)
      .maybeSingle();

    if (fetchErr || !order) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }

    // Only allow customer cancellation for revolut pay-after-delivery orders
    const isRevolutPayAfterDelivery =
      order.payment_method === "revolut" && order.pay_after_delivery === true;
    const cancellableStatuses = ["waiting", "confirmed", "out_for_delivery", "payment_pending"];

    if (!isRevolutPayAfterDelivery) {
      return NextResponse.json(
        { error: "This order cannot be cancelled by the customer." },
        { status: 403 }
      );
    }

    if (!cancellableStatuses.includes(String(order.status))) {
      return NextResponse.json(
        { error: "Order is no longer cancellable." },
        { status: 403 }
      );
    }

    const deferStock = Boolean((order as { defer_stock_until_approval?: boolean }).defer_stock_until_approval);
    const skipStockRestore = (order.status === "payment_pending" || order.status === "pre_ordered") && deferStock;

    if (!skipStockRestore) {
      const { error: rpcErr } = await supabase.rpc("restore_product_stock", {
        p_product_id: order.product_id,
        p_quantity: order.quantity,
      });

      if (rpcErr) {
        console.error("[orders/cancel] restore stock", rpcErr);
        return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
      }
    }

    const { error: upErr } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (upErr) {
      console.error("[orders/cancel]", upErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
