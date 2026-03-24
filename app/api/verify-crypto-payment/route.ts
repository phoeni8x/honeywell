import { getClientIp } from "@/lib/client-ip";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { ratelimitVerifyCrypto } from "@/lib/ratelimit";
import { NextResponse } from "next/server";

/**
 * Part 2: blockchain verification (Etherscan / Blockstream).
 * Stub: records intent; wire explorer polling in production.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { success } = await ratelimitVerifyCrypto.limit(ip);
  if (!success) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body.order_id as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
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
