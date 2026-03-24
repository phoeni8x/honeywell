import { getClientIp } from "@/lib/client-ip";
import { handleCreateOrder } from "@/lib/order-create-handler";
import { PUBLIC_ERROR_RATE_LIMIT_ORDERS } from "@/lib/public-error";
import { ratelimitCreateOrder } from "@/lib/ratelimit";
import { NextResponse } from "next/server";

/** Alias route (Part 2 spec name) — same behavior + rate limit as /api/orders/create */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { success } = await ratelimitCreateOrder.limit(ip);
  if (!success) {
    return NextResponse.json({ error: PUBLIC_ERROR_RATE_LIMIT_ORDERS, code: "rate_limited" }, { status: 429 });
  }
  return handleCreateOrder(request);
}
