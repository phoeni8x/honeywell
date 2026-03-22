import { sanitizePlainText } from "@/lib/sanitize";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createServerSupabase();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const ticketId = body.ticket_id as string | undefined;
    const message = sanitizePlainText(String(body.message ?? ""), 8000);
    const status = body.status as string | undefined;

    if (!ticketId || !message.trim()) {
      return NextResponse.json({ error: "ticket_id and message required" }, { status: 400 });
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
      return NextResponse.json({ error: mErr.message }, { status: 400 });
    }

    const patch: Record<string, string> = { updated_at: new Date().toISOString() };
    if (nextStatus) patch.status = nextStatus;

    await svc.from("tickets").update(patch).eq("id", ticketId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
