import { executeAdminApproveOrder } from "@/lib/admin-approve-order";
import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Part 9 alias — same behavior as `POST /api/admin/orders/confirm` (admin session required).
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = await request.json();
    const order_id = body.order_id as string | undefined;
    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const result = await executeAdminApproveOrder(order_id);
    if (!result.success) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      order_id: result.order_id,
      points_earned: result.points_earned,
      new_level: result.new_level,
      previous_level: result.previous_level,
      leveled_up: result.leveled_up,
      level_name: result.level_name,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
