import { LEVEL_META } from "@/lib/levels";
import { notifyCustomerPush } from "@/lib/push-notify";
import { createServiceClient } from "@/lib/supabase/admin";

export type AdminApproveSuccess = {
  success: true;
  order_id: string;
  points_earned: number;
  new_level: number;
  previous_level: number;
  leveled_up: boolean;
  level_name: string;
};

export type AdminApproveFailure = {
  success: false;
  error: string;
  status: number;
  code?: string;
};

/**
 * Admin approves a `payment_pending` order: deduct stock, advance status, award points/bees via `processOrderConfirmed`.
 */
export async function executeAdminApproveOrder(orderId: string): Promise<AdminApproveSuccess | AdminApproveFailure> {
  const svc = createServiceClient();
  const { data: order, error: fetchErr } = await svc.from("orders").select("*").eq("id", orderId).maybeSingle();

  if (fetchErr || !order) {
    console.error("[admin approve] fetch", fetchErr);
    return { success: false, error: "Order not found", status: 404 };
  }

  if (order.status !== "payment_pending") {
    return { success: false, error: "Order is not pending approval", status: 400, code: "not_pending" };
  }

  const productId = order.product_id as string;
  const qty = Number(order.quantity ?? 0);
  const { data: product, error: prodErr } = await svc
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .maybeSingle();

  if (prodErr || !product) {
    console.error("[admin approve] product", prodErr);
    return { success: false, error: "Product not found", status: 400 };
  }
  const stock = Number(product.stock_quantity ?? 0);
  if (stock < qty) {
    return {
      success: false,
      error: "Insufficient stock for this order.",
      status: 400,
      code: "insufficient_stock",
    };
  }

  const { error: stockUpErr } = await svc.from("products").update({ stock_quantity: stock - qty }).eq("id", productId);

  if (stockUpErr) {
    console.error("[admin approve] stock", stockUpErr);
    return { success: false, error: "Stock update failed", status: 500 };
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
      console.error("[admin approve]", upErr);
      return { success: false, error: "Order update failed", status: 400 };
    }
  } else {
    const { error: upErr } = await svc
      .from("orders")
      .update({ status: "confirmed", updated_at: now })
      .eq("id", orderId)
      .eq("status", "payment_pending");

    if (upErr) {
      console.error("[admin approve]", upErr);
      return { success: false, error: "Order update failed", status: 400 };
    }
  }

  const customerToken = order.customer_token as string | undefined;
  if (customerToken) {
    const bodyText = isRevolutDeliveryPayNow
      ? "Payment received — we're preparing your order."
      : "Your order is confirmed.";
    let extra = "";
    // Points are awarded when order is completed (delivered/picked_up), not at approval.
    void notifyCustomerPush(customerToken, {
      title: "Order update",
      body: `${bodyText}${extra}`.slice(0, 180),
      url: `/account/orders/${orderId}/track`,
      tag: `order-${orderId}`,
    });
  }

  return {
    success: true,
    order_id: orderId,
    points_earned: 0,
    new_level: 1,
    previous_level: 1,
    leveled_up: false,
    level_name: LEVEL_META[1]?.name ?? "Newbie",
  };
}
