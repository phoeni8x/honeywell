import { notifyCustomerPush } from "@/lib/push-notify";
import { productStockWasDeductedAtCheckout } from "@/lib/order-payment-pending-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_EXPIRE_MINUTES = 45;

const AUTO_REJECTION_REASON =
  "Payment was not confirmed in time — this order expired automatically. Place a new order if you still want the product.";

export type ExpireStalePaymentPendingResult = {
  expired: number;
  /** Stock restore failures (order already marked payment_expired). */
  stockRestoreFailures: number;
};

/**
 * Marks `payment_pending` orders older than `expireMinutes` as `payment_expired`,
 * restores product stock when applicable, and notifies customers by push.
 */
export async function expireStalePaymentPendingOrders(
  svc: SupabaseClient,
  expireMinutes: number = DEFAULT_EXPIRE_MINUTES
): Promise<ExpireStalePaymentPendingResult> {
  const minutes = Number.isFinite(expireMinutes) && expireMinutes > 0 ? expireMinutes : DEFAULT_EXPIRE_MINUTES;
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: expiredRows, error: upErr } = await svc
    .from("orders")
    .update({
      status: "payment_expired",
      updated_at: now,
      rejection_reason: AUTO_REJECTION_REASON,
    })
    .eq("status", "payment_pending")
    .lt("created_at", cutoff)
    .select("id, customer_token, order_number, product_id, quantity, defer_stock_until_approval");

  if (upErr) {
    console.error("[expireStalePaymentPendingOrders] bulk update", upErr);
    throw new Error(upErr.message ?? "update failed");
  }

  const rows = expiredRows ?? [];
  let stockRestoreFailures = 0;

  for (const row of rows) {
    const id = row.id as string;
    if (productStockWasDeductedAtCheckout(row.defer_stock_until_approval)) {
      const productId = row.product_id as string | null;
      const qty = Number(row.quantity ?? 0);
      if (productId && qty > 0) {
        const { error: rpcErr } = await svc.rpc("restore_product_stock", {
          p_product_id: productId,
          p_quantity: qty,
        });
        if (rpcErr) {
          console.error("[expireStalePaymentPendingOrders] restore_product_stock", id, rpcErr);
          stockRestoreFailures += 1;
        }
      }
    }

    const customerToken = row.customer_token as string | undefined;
    const orderNumber = (row.order_number as string | undefined) ?? id.slice(0, 8);
    if (customerToken) {
      void notifyCustomerPush(customerToken, {
        title: "Order expired",
        body: `Order ${orderNumber} timed out awaiting payment. You can place a new order anytime.`,
        url: "/order-history",
        tag: `payment-expired-${id}`,
      });
    }
  }

  return { expired: rows.length, stockRestoreFailures };
}
