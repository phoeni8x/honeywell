import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { sanitizePlainText } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketNumber: string }> };

export async function POST(request: Request, context: Params) {
  const token = request.headers.get("x-customer-token");
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const { ticketNumber } = await context.params;
  const decoded = decodeURIComponent(ticketNumber);

  try {
    const body = await request.json();
    const message = sanitizePlainText(String(body.message ?? ""), 8000);
    if (!message.trim()) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id, status")
      .eq("ticket_number", decoded)
      .eq("customer_token", token)
      .maybeSingle();

    if (tErr || !ticket) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }
    if (ticket.status === "closed") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { error: mErr } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender: "customer",
      message: message.trim(),
    });

    if (mErr) {
      console.error("[ticket message insert]", mErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    await supabase
      .from("tickets")
      .update({
        updated_at: new Date().toISOString(),
        status: ticket.status === "resolved" ? "open" : ticket.status,
      })
      .eq("id", ticket.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
