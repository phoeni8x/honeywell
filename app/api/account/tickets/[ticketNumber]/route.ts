import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketNumber: string }> };

export async function GET(request: Request, context: Params) {
  const token = getCustomerTokenFromRequest(request);
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketNumber } = await context.params;
  const decoded = decodeURIComponent(ticketNumber);
  const supabase = createServiceClient();

  const { data: ticket, error: tErr } = await supabase
    .from("tickets")
    .select("id, ticket_number, subject, category, status, created_at, updated_at")
    .eq("ticket_number", decoded)
    .eq("customer_token", token)
    .maybeSingle();

  if (tErr || !ticket) {
    if (tErr) console.error("[ticket GET] ticket error:", tErr);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Return full customer-visible thread by ticket_id.
  const { data: messages, error: mErr } = await supabase
    .from("ticket_messages")
    .select("id, ticket_id, sender, message, media_urls, created_at, is_read")
    .eq("ticket_id", ticket.id)
    .in("sender", ["customer", "admin"])
    .order("created_at", { ascending: true });

  if (mErr) {
    console.error("[ticket GET] messages error:", mErr);
    return NextResponse.json({ error: "Failed to load thread" }, { status: 500 });
  }

  return NextResponse.json({ ticket, messages: messages ?? [] });
}
