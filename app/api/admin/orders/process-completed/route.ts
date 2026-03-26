import { requireAdminUser } from "@/lib/admin-auth";
import { processOrderConfirmed } from "@/lib/order-confirmation-server";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { order_id?: string };
    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    if (!orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const result = await processOrderConfirmed(orderId);
    if (!result.ok) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      points_earned: result.pointsEarned ?? 0,
      leveled_up: result.leveledUp ?? false,
      new_level: result.newLevel ?? 1,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
