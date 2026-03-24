import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { sanitizePlainText } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ticketId = body.ticket_id as string | undefined;
    const message = sanitizePlainText(String(body.message ?? ""), 8000);
    const status = body.status as string | undefined;

    if (!ticketId || !message.trim()) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const allowed = ["open", "in_progress", "resolved", "closed"];
    const nextStatus = status && allowed.includes(status) ? status : undefined;

    const svc = createServiceClient();
    const { error: mErr } = await svc.from("ticket_messages").insert({
      ticket_id: ticketId,
      sender: "admin",
      message: message.trim(),
    });

    if (mErr) {
      console.error("[admin ticket reply]", mErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const patch: Record<string, string> = { updated_at: new Date().toISOString() };
    if (nextStatus) patch.status = nextStatus;

    await svc.from("tickets").update(patch).eq("id", ticketId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
