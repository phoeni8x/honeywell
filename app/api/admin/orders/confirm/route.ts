import { executeAdminApproveOrder, type AdminApproveIssueLockerPayload } from "@/lib/admin-approve-order";
import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = await request.json();
    const orderId = body.order_id as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const rawIssue = body.issue_locker as Record<string, unknown> | undefined;
    let issueLocker: AdminApproveIssueLockerPayload | undefined;
    if (rawIssue && typeof rawIssue === "object") {
      issueLocker = {
        locker_provider:
          typeof rawIssue.locker_provider === "string" || rawIssue.locker_provider === null
            ? (rawIssue.locker_provider as string | null)
            : undefined,
        locker_location_text: String(rawIssue.locker_location_text ?? ""),
        locker_passcode: String(rawIssue.locker_passcode ?? ""),
      };
    }

    const result = await executeAdminApproveOrder(orderId, issueLocker ? { issueLocker } : undefined);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      order_id: result.order_id,
      points_earned: result.points_earned,
      new_level: result.new_level,
      previous_level: result.previous_level,
      leveled_up: result.leveled_up,
      level_name: result.level_name,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
