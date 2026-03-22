import { getClientIp } from "@/lib/client-ip";
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
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const orderId = body.order_id as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 });
    }

    return NextResponse.json({
      status: "pending",
      message: "Verification stub — connect ETHERSCAN_API_KEY and chain polling to enable auto-confirm.",
      order_id: orderId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
