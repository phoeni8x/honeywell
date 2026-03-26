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
    .select("*")
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

  const thread = [...(messages ?? [])];
  if (thread.length === 0) {
    const legacyText =
      (typeof (ticket as { initial_message?: unknown }).initial_message === "string" &&
        (ticket as { initial_message?: string }).initial_message) ||
      (typeof (ticket as { body?: unknown }).body === "string" &&
        (ticket as { body?: string }).body) ||
      (typeof (ticket as { message?: unknown }).message === "string" &&
        (ticket as { message?: string }).message) ||
      "";
    if (legacyText.trim()) {
      thread.push({
        id: `legacy-${ticket.id}`,
        ticket_id: ticket.id,
        sender: "customer",
        message: legacyText.trim(),
        media_urls: null,
        created_at:
          typeof (ticket as { created_at?: unknown }).created_at === "string"
            ? (ticket as { created_at?: string }).created_at
            : new Date().toISOString(),
        is_read: true,
      });
    }
  }

  return NextResponse.json({
    ticket: {
      id: String((ticket as { id?: unknown }).id ?? ""),
      ticket_number: String((ticket as { ticket_number?: unknown }).ticket_number ?? ""),
      subject: String((ticket as { subject?: unknown }).subject ?? ""),
      status: String((ticket as { status?: unknown }).status ?? "open"),
      created_at:
        typeof (ticket as { created_at?: unknown }).created_at === "string"
          ? (ticket as { created_at?: string }).created_at
          : new Date().toISOString(),
      updated_at:
        typeof (ticket as { updated_at?: unknown }).updated_at === "string"
          ? (ticket as { updated_at?: string }).updated_at
          : new Date().toISOString(),
    },
    messages: thread,
  });
}
