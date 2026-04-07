import { notifyCustomerPush } from "@/lib/push-notify";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_EXPIRE_HOURS = 7;

const AUTO_REJECTION_REASON =
  "The team did not accept this booking in time — it was cancelled automatically. You can place a new booking anytime.";

export type ExpireStaleBookingResult = {
  cancelled: number;
};

/**
 * Cancels `pre_ordered` + `booking` orders older than `expireHours` (no stock restore — matches admin bulk booking clear).
 */
export async function expireStaleBookingOrders(
  svc: SupabaseClient,
  expireHours: number = DEFAULT_EXPIRE_HOURS
): Promise<ExpireStaleBookingResult> {
  const hours = Number.isFinite(expireHours) && expireHours > 0 ? expireHours : DEFAULT_EXPIRE_HOURS;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: cancelledRows, error: upErr } = await svc
    .from("orders")
    .update({
      status: "cancelled",
      updated_at: now,
      rejection_reason: AUTO_REJECTION_REASON,
    })
    .eq("status", "pre_ordered")
    .eq("payment_method", "booking")
    .lt("created_at", cutoff)
    .select("id, customer_token, order_number");

  if (upErr) {
    console.error("[expireStaleBookingOrders] bulk update", upErr);
    throw new Error(upErr.message ?? "booking expire update failed");
  }

  const rows = cancelledRows ?? [];

  for (const row of rows) {
    const id = row.id as string;
    const customerToken = row.customer_token as string | undefined;
    const orderNumber = (row.order_number as string | undefined) ?? id.slice(0, 8);
    if (customerToken) {
      void notifyCustomerPush(customerToken, {
        title: "Booking request timed out",
        body: `Booking ${orderNumber} was not accepted in time and was cancelled. You can try again anytime.`,
        url: "/order-history",
        tag: `booking-expired-${id}`,
      });
    }
  }

  return { cancelled: rows.length };
}
