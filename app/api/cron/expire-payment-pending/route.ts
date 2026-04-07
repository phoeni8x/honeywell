import { expireStaleBookingOrders } from "@/lib/expire-stale-booking-orders";
import { expireStalePaymentPendingOrders } from "@/lib/expire-stale-payment-pending-orders";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** Payment + booking expiry loops — allow headroom on cold starts. */
export const maxDuration = 60;

/**
 * Secured with `CRON_SECRET` or `INTERNAL_PUSH_SECRET` (Authorization: Bearer …).
 * - `PAYMENT_PENDING_EXPIRE_MINUTES` (default 45) → `payment_expired`
 * - `BOOKING_PENDING_EXPIRE_HOURS` (default 7) → `cancelled` for `pre_ordered` + `booking`
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.INTERNAL_PUSH_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawMin = process.env.PAYMENT_PENDING_EXPIRE_MINUTES?.trim();
  const expireMinutes = rawMin ? Number(rawMin) : 45;
  const rawBookHrs = process.env.BOOKING_PENDING_EXPIRE_HOURS?.trim();
  const bookingExpireHours = rawBookHrs ? Number(rawBookHrs) : 7;

  const svc = createServiceClient();
  const bookHrs = Number.isFinite(bookingExpireHours) && bookingExpireHours > 0 ? bookingExpireHours : 7;
  const payMin = Number.isFinite(expireMinutes) && expireMinutes > 0 ? expireMinutes : 45;

  const [payOutcome, bookOutcome] = await Promise.allSettled([
    expireStalePaymentPendingOrders(svc, payMin),
    expireStaleBookingOrders(svc, bookHrs),
  ]);

  const payment =
    payOutcome.status === "fulfilled"
      ? {
          expired: payOutcome.value.expired,
          stock_restore_failures: payOutcome.value.stockRestoreFailures,
          expire_minutes: payMin,
        }
      : {
          expired: 0,
          stock_restore_failures: 0,
          expire_minutes: payMin,
          error: payOutcome.reason instanceof Error ? payOutcome.reason.message : "payment_pending job failed",
        };

  const booking =
    bookOutcome.status === "fulfilled"
      ? { cancelled: bookOutcome.value.cancelled, expire_hours: bookHrs }
      : { cancelled: 0, expire_hours: bookHrs, error: bookOutcome.reason instanceof Error ? bookOutcome.reason.message : "booking job failed" };

  if (payOutcome.status === "rejected") {
    console.error("[cron] expireStalePaymentPendingOrders", payOutcome.reason);
  }
  if (bookOutcome.status === "rejected") {
    console.error("[cron] expireStaleBookingOrders", bookOutcome.reason);
  }

  const ok = payOutcome.status === "fulfilled" && bookOutcome.status === "fulfilled";
  return NextResponse.json({ ok, payment_pending: payment, booking }, { status: ok ? 200 : 207 });
}
