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

type Params = { params: Promise<{ ticketNumber: string }> };

export async function POST(request: Request, context: Params) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }
  if (await isCustomerBanned(token)) {
    return NextResponse.json({ error: "Your account is currently blocked. Please contact support." }, { status: 403 });
  }

  const { ticketNumber } = await context.params;
  const decoded = decodeURIComponent(ticketNumber);

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

    const body = (await request.json().catch(() => null)) as
      | { message?: string; media_urls?: string[] }
      | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const message = sanitizePlainText(String(body.message ?? ""), 8000);
    const rawMedia = body.media_urls;
    const mediaUrls =
      Array.isArray(rawMedia) && rawMedia.length > 0
        ? rawMedia
            .slice(0, 8)
            .map((u: unknown) => sanitizePlainText(String(u ?? ""), 2000))
            .filter((u: string) => u.length > 0)
        : null;
    if (!message.trim() && (!mediaUrls || mediaUrls.length === 0)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id, status, ticket_number")
      .eq("ticket_number", decoded)
      .eq("customer_token", token)
      .maybeSingle();

    let resolvedTicket = ticket;
    let resolvedErr = tErr;
    if (!resolvedTicket) {
      const fallback = await supabase
        .from("tickets")
        .select("id, status, ticket_number")
        .eq("ticket_number", decoded)
        .maybeSingle();
      resolvedTicket = fallback.data ?? null;
      if (!resolvedErr && fallback.error) resolvedErr = fallback.error;
    }

    if (resolvedErr || !resolvedTicket) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }
    if (resolvedTicket.status === "closed") {
      return NextResponse.json({ error: "Ticket is closed" }, { status: 403 });
    }

    const { data: insertedMessage, error: mErr } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: resolvedTicket.id,
        sender: "customer",
        message: message.trim() || "(attachment)",
        media_urls: mediaUrls ?? null,
      })
      .select("id, ticket_id, sender, message, media_urls, created_at, is_read")
      .single();

    if (mErr) {
      console.error("[ticket message insert]", mErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    await supabase
      .from("tickets")
      .update({
        updated_at: new Date().toISOString(),
        status: resolvedTicket.status === "open" ? "in_progress" : resolvedTicket.status,
      })
      .eq("id", resolvedTicket.id);

    const preview = message.trim() || "New attachment";
    void notifyAdminPush({
      title: "New customer message",
      body: preview.slice(0, 140),
      url: `${ADMIN_BASE_PATH}/tickets`,
      tag: `ticket-${resolvedTicket.ticket_number}`,
    });

    return NextResponse.json({ message: insertedMessage });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
