import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketNumber: string }> };

export async function GET(_request: Request, context: Params) {
  const token = _request.headers.get("x-customer-token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
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
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages, error: mErr } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  return NextResponse.json({ ticket, messages: messages ?? [] });
}
