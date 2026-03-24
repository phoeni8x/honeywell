import { ADMIN_BASE_PATH } from "@/lib/constants";
import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { notifyAdminPush } from "@/lib/push-notify";
import { sanitizePlainText } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketNumber: string }> };

export async function POST(request: Request, context: Params) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const { ticketNumber } = await context.params;
  const decoded = decodeURIComponent(ticketNumber);

  try {
    const body = await request.json();
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

    const supabase = createServiceClient();
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id, status, ticket_number")
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
      message: message.trim() || "(attachment)",
      media_urls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : null,
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

    const preview = message.trim() || "New attachment";
    void notifyAdminPush({
      title: "New customer message",
      body: preview.slice(0, 140),
      url: `${ADMIN_BASE_PATH}/tickets`,
      tag: `ticket-${ticket.ticket_number}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
