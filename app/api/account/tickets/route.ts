import { ADMIN_BASE_PATH } from "@/lib/constants";
import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { isCustomerBanned } from "@/lib/customer-moderation";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { notifyAdminPush } from "@/lib/push-notify";
import { sanitizePlainText } from "@/lib/sanitize";
import { parseSupportEnabled } from "@/lib/support-settings";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseOrderId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || !UUID_RE.test(s)) return null;
  return s;
}

export async function GET(request: Request) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, ticket_number, subject, category, status, created_at, updated_at")
    .eq("customer_token", token)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[tickets GET]", error);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }

  return NextResponse.json({ tickets: tickets ?? [] });
}

export async function POST(request: Request) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }
  if (await isCustomerBanned(token)) {
    return NextResponse.json({ error: "Your account is currently blocked. Please contact support." }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();
    const { data: supportSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "support_enabled")
      .maybeSingle();
    if (!parseSupportEnabled(supportSetting?.value)) {
      return NextResponse.json(
        { error: "Support is currently offline. Please come back later." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const subject = sanitizePlainText(String(body.subject ?? ""), 200);
    const message = sanitizePlainText(String(body.message ?? ""), 8000);
    const category = sanitizePlainText(String(body.category ?? "other"), 40);
    const orderId = parseOrderId(body.order_id);

    if (!subject.trim() || !message.trim()) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const allowed = ["order", "payment", "pickup", "product", "other"];
    const cat = allowed.includes(category) ? category : "other";

    if (orderId) {
      const { data: ord } = await supabase
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .eq("customer_token", token)
        .maybeSingle();
      if (!ord) {
        return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
      }
    }

    const { data: ticketRow, error: tErr } = await supabase
      .from("tickets")
      .insert({
        customer_token: token,
        subject: subject.trim(),
        category: cat,
        ...(orderId ? { order_id: orderId } : {}),
        status: "open",
      })
      .select("*")
      .single();

    if (tErr || !ticketRow) {
      console.error("[tickets POST]", tErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    const { data: firstMessage, error: mErr } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketRow.id,
        sender: "customer",
        message: message.trim(),
      })
      .select("id, ticket_id, sender, message, media_urls, created_at, is_read")
      .single();

    if (mErr || !firstMessage) {
      console.error("[tickets POST message]", mErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    await supabase
      .from("tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticketRow.id);

    const { data: freshTicket, error: freshTicketErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, subject, category, status, created_at, updated_at")
      .eq("id", ticketRow.id)
      .single();

    if (freshTicketErr || !freshTicket) {
      console.error("[tickets POST fresh ticket]", freshTicketErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    const { data: threadMessages, error: threadErr } = await supabase
      .from("ticket_messages")
      .select("id, ticket_id, sender, message, media_urls, created_at, is_read")
      .eq("ticket_id", ticketRow.id)
      .order("created_at", { ascending: true });

    if (threadErr) {
      console.error("[tickets POST thread]", threadErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    void notifyAdminPush({
      title: "New support ticket",
      body: `${freshTicket.ticket_number}: ${subject.trim()}`.slice(0, 140),
      url: `${ADMIN_BASE_PATH}/tickets`,
      tag: `ticket-${freshTicket.ticket_number}`,
    });

    return NextResponse.json({
      ticket: freshTicket,
      messages: threadMessages ?? [firstMessage],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
