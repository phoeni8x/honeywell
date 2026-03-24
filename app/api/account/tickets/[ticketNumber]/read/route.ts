import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketNumber: string }> };

/** Mark visible admin replies as read (customer opened the thread). */
export async function POST(request: Request, context: Params) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const { ticketNumber } = await context.params;
  const decoded = decodeURIComponent(ticketNumber);

  const supabase = createServiceClient();
  const { data: ticket, error: tErr } = await supabase
    .from("tickets")
    .select("id")
    .eq("ticket_number", decoded)
    .eq("customer_token", token)
    .maybeSingle();

  if (tErr || !ticket) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("ticket_messages")
    .update({ is_read: true, read_at: now })
    .eq("ticket_id", ticket.id)
    .eq("sender", "admin");

  if (uErr) {
    console.error("[ticket read]", uErr);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
