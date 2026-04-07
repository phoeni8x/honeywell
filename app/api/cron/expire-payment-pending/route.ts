import { expireStalePaymentPendingOrders } from "@/lib/expire-stale-payment-pending-orders";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** Parcel locker expiry loops — allow headroom on cold starts. */
export const maxDuration = 60;

/**
 * Vercel Cron: secured with `CRON_SECRET` (Authorization: Bearer …).
 * Vercel injects that header automatically when `CRON_SECRET` is set on the project.
 * Fallback: `INTERNAL_PUSH_SECRET` if you trigger the same URL manually with that bearer.
 * Set `PAYMENT_PENDING_EXPIRE_MINUTES` to override default 45.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.INTERNAL_PUSH_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawMin = process.env.PAYMENT_PENDING_EXPIRE_MINUTES?.trim();
  const expireMinutes = rawMin ? Number(rawMin) : 45;

  try {
    const svc = createServiceClient();
    const result = await expireStalePaymentPendingOrders(svc, expireMinutes);
    return NextResponse.json({
      ok: true,
      expired: result.expired,
      stock_restore_failures: result.stockRestoreFailures,
      expire_minutes: Number.isFinite(expireMinutes) && expireMinutes > 0 ? expireMinutes : 45,
    });
  } catch (e) {
    console.error("[cron/expire-payment-pending]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
