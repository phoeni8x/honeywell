import { issueLockerForDeadDropOrderAndNotifyService, validateIssueLockerInput } from "@/lib/admin-issue-locker";
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
    const lockerProvider = typeof body.locker_provider === "string" ? body.locker_provider.trim() : "";
    const lockerLocationText = typeof body.locker_location_text === "string" ? body.locker_location_text.trim() : "";
    const lockerPasscode = typeof body.locker_passcode === "string" ? body.locker_passcode.trim() : "";

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const validated = validateIssueLockerInput({
      orderId,
      lockerProvider,
      lockerLocationText,
      lockerPasscode,
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error, code: validated.code }, { status: 400 });
    }

    const result = await issueLockerForDeadDropOrderAndNotifyService({
      orderId,
      lockerProvider,
      lockerLocationText,
      lockerPasscode,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }

    return NextResponse.json({ ok: true, order_id: orderId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
