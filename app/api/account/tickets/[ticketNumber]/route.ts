import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketNumber: string }> };

export async function GET(request: Request, context: Params) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const { ticketNumber } = await context.params;
  const decoded = decodeURIComponent(ticketNumber);

  const supabase = createServiceClient();
  const { data: ticket, error: tErr } = await supabase
    .from("tickets")
    .select("*")
    .eq("ticket_number", decoded)
    .eq("customer_token", token)
    .maybeSingle();

  if (tErr) {
    console.error("[ticket GET]", tErr);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
  }

  const { data: messages, error: mErr } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", ticket.id)
    .not("sender", "eq", "admin_internal")
    .order("created_at", { ascending: true });

  if (mErr) {
    console.error("[ticket messages]", mErr);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }

  return NextResponse.json({ ticket, messages: messages ?? [] });
}
