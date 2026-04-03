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
 * Admin approves `payment_pending`: non–dead-drop deducts product stock here; dead_drop (no slot yet)
 * deducts stock and assigns a free dead drop in one DB transaction via `confirm_dead_drop_payment_and_assign`.
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

  const isRevolutDeliveryPayNow =
    order.payment_method === "revolut" &&
    order.fulfillment_type === "delivery" &&
    order.revolut_pay_timing === "pay_now";

  const now = new Date().toISOString();

  async function maybeDeductDeadDropStockIfConfirmed() {
    const { data: refreshed } = await svc
      .from("orders")
      .select("product_id,quantity,defer_stock_until_approval,status,dead_drop_id,fulfillment_type")
      .eq("id", orderId)
      .maybeSingle();

    if (
      !refreshed ||
      refreshed.fulfillment_type !== "dead_drop" ||
      refreshed.status !== "confirmed" ||
      !refreshed.dead_drop_id ||
      !refreshed.defer_stock_until_approval
    ) {
      return;
    }

    const productId = refreshed.product_id as string | null;
    const qty = Number(refreshed.quantity ?? 0);
    if (!productId || qty <= 0) return;

    const { data: product } = await svc.from("products").select("stock_quantity").eq("id", productId).maybeSingle();
    const stock = Number(product?.stock_quantity ?? 0);
    if (stock < qty) {
      throw new Error("insufficient_stock");
    }

    const { error: stockUpErr } = await svc.from("products").update({ stock_quantity: stock - qty }).eq("id", productId);
    if (stockUpErr) {
      throw new Error("stock_update_failed");
    }

    await svc.from("orders").update({ defer_stock_until_approval: false }).eq("id", orderId);
  }

  // Dead drop: payment approval deducts stock in DB and sets awaiting_dead_drop; slot is assigned later (Give drop).
  if (order.fulfillment_type === "dead_drop") {
    if (!order.dead_drop_id) {
      const { error: rpcErr } = await svc.rpc("confirm_dead_drop_payment_and_assign", {
        p_order_id: orderId,
      });

      if (rpcErr) {
        const msg = String(rpcErr.message ?? "").toLowerCase();
        console.error("[admin approve dead_drop confirm]", rpcErr);
        if (msg.includes("insufficient_stock")) {
          return {
            success: false,
            error: "Not enough product stock to confirm — adjust stock or cancel order.",
            status: 400,
            code: "insufficient_stock",
          };
        }
        return { success: false, error: "Could not confirm payment for this order.", status: 400 };
      }

      const tokenEarly = order.customer_token as string | undefined;
      if (tokenEarly) {
        void notifyCustomerPush(tokenEarly, {
          title: "Payment accepted",
          body: "We'll send your dead drop location (map, photos, notes) when it's assigned.",
          url: `/account/orders/${orderId}/track`,
          tag: `order-${orderId}-paid`,
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

    // Preorder path: slot already chosen at checkout
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

    // In the broken live state, dead_drop_id might be present already and stock might not be deducted.
    // Deduct only when the order is confirmed and `defer_stock_until_approval` is still true.
    try {
      await maybeDeductDeadDropStockIfConfirmed();
    } catch (e) {
      return { success: false, error: "Dead drop stock deduction failed.", status: 400 };
    }

    const customerToken = order.customer_token as string | undefined;
    if (customerToken) {
      const bodyText = isRevolutDeliveryPayNow
        ? "Payment received — we're preparing your order."
        : "Your order is confirmed.";
      void notifyCustomerPush(customerToken, {
        title: "Order update",
        body: `${bodyText}`.slice(0, 180),
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
    void notifyCustomerPush(customerToken, {
      title: "Order update",
      body: `${bodyText}`.slice(0, 180),
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
