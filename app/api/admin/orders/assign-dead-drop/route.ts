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
          { error: "No pickup slot available in the legacy pool. Use parcel locker from Orders instead.", code: "dead_drop_unavailable" },
          { status: 400 }
        );
      }
      if (msg.includes("not_awaiting_dead_drop") || msg.includes("not_dead_drop")) {
        return NextResponse.json({ error: "Order is not ready for legacy slot assignment.", code: "invalid_state" }, { status: 400 });
      }
      console.error("[assign_dead_drop_for_order]", rpcErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    // Stock deduction: in the broken live state, dead-drop slot assignment doesn't always decrement product stock.
    // We only deduct when the order is now confirmed and `defer_stock_until_approval` is still true.
    const { data: updatedOrder } = await svc
      .from("orders")
      .select("product_id,quantity,defer_stock_until_approval,status,dead_drop_id,fulfillment_type")
      .eq("id", orderId)
      .maybeSingle();

    if (
      updatedOrder &&
      updatedOrder.fulfillment_type === "dead_drop" &&
      updatedOrder.status === "confirmed" &&
      updatedOrder.dead_drop_id &&
      updatedOrder.defer_stock_until_approval
    ) {
      const productId = updatedOrder.product_id as string | null;
      const qty = Number(updatedOrder.quantity ?? 0);
      if (productId && qty > 0) {
        const { data: product } = await svc.from("products").select("stock_quantity").eq("id", productId).maybeSingle();
        const stock = Number(product?.stock_quantity ?? 0);
        if (stock < qty) {
          return NextResponse.json(
            { error: "Insufficient stock to confirm this order.", code: "insufficient_stock" },
            { status: 400 }
          );
        }
        const { error: stockUpErr } = await svc.from("products").update({ stock_quantity: stock - qty }).eq("id", productId);
        if (stockUpErr) {
          return NextResponse.json({ error: "Failed to deduct stock.", code: "stock_update_failed" }, { status: 400 });
        }
        await svc.from("orders").update({ defer_stock_until_approval: false }).eq("id", orderId);
      }
    }

    const { data: order } = await svc
      .from("orders")
      .select("customer_token, order_number")
      .eq("id", orderId)
      .maybeSingle();

    const customerToken = order?.customer_token as string | undefined;
    if (customerToken) {
      void notifyCustomerPush(customerToken, {
        title: "Pickup location ready",
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
