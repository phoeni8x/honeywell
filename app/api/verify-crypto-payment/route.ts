import { getClientIp } from "@/lib/client-ip";
import { executeAdminApproveOrder } from "@/lib/admin-approve-order";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { ratelimitVerifyCrypto } from "@/lib/ratelimit";
import { NextResponse } from "next/server";

/**
 * Part 2: blockchain verification (Etherscan / Blockstream).
 * Stub: records intent; wire explorer polling in production.
 *
 * E2E / staging: when ALLOW_E2E_PAYMENT_APPROVE=true and the caller sends a matching
 * E2E_PAYMENT_APPROVE_SECRET, we run the same admin approval path as a human operator
 * (executeAdminApproveOrder). Production must leave ALLOW_E2E_PAYMENT_APPROVE unset — no bypass.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body.order_id as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const e2eSecret =
      typeof body.e2e_confirm_secret === "string" ? body.e2e_confirm_secret.trim() : "";
    const serverSecret = process.env.E2E_PAYMENT_APPROVE_SECRET?.trim() ?? "";
    const allowE2E =
      process.env.ALLOW_E2E_PAYMENT_APPROVE === "true" &&
      serverSecret.length >= 16 &&
      e2eSecret.length > 0;

    if (allowE2E && e2eSecret === serverSecret) {
      const result = await executeAdminApproveOrder(orderId);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.status }
        );
      }
      return NextResponse.json({
        status: "approved",
        order_id: orderId,
        e2e_auto_approve: true,
      });
    }

    const ip = getClientIp(request);
    const { success } = await ratelimitVerifyCrypto.limit(ip);
    if (!success) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 429 });
    }

    return NextResponse.json({
      status: "pending",
      order_id: orderId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
