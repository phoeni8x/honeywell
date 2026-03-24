import { notifyAdminPush, notifyCustomerPush, type PushPayload } from "@/lib/push-notify";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Server-to-server push (e.g. order status cron). Protect with INTERNAL_PUSH_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.INTERNAL_PUSH_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const target = body.target as string | undefined;
    const customerToken = body.customer_token as string | undefined;
    const payload = body.payload as PushPayload | undefined;
    if (!payload?.title || !payload?.body) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (target === "admin") {
      await notifyAdminPush(payload);
    } else if (target === "customer" && customerToken) {
      await notifyCustomerPush(customerToken, payload);
    } else {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
