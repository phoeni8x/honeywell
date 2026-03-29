import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { notifyCustomerPush } from "@/lib/push-notify";
import { sanitizePlainText } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          ticket_id?: string;
          message?: string;
          internal?: boolean;
          status?: string;
          set_status?: string;
          media_urls?: string[];
        }
      | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const ticketId = body.ticket_id as string | undefined;
    const message = sanitizePlainText(String(body.message ?? ""), 8000);
    const status = (body.set_status ?? body.status) as string | undefined;
    const internal = Boolean(body.internal);
    const mediaUrls =
      Array.isArray(body.media_urls) && body.media_urls.length > 0
        ? body.media_urls
            .slice(0, 8)
            .map((u) => sanitizePlainText(String(u ?? ""), 2000))
            .filter((u) => u.length > 0)
        : null;

    if (!ticketId) {
      return NextResponse.json({ error: "ticket_id required" }, { status: 400 });
    }

    if (!message.trim() && (!mediaUrls || mediaUrls.length === 0)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const allowed = ["open", "in_progress", "resolved", "closed"];
    const nextStatus = status && allowed.includes(status) ? status : undefined;

    const svc = createServiceClient();
    const { data: ticket, error: tFetchErr } = await svc
      .from("tickets")
      .select("customer_token, ticket_number")
      .eq("id", ticketId)
      .maybeSingle();

    if (tFetchErr || !ticket) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { error: mErr } = await svc.from("ticket_messages").insert({
      ticket_id: ticketId,
      sender: internal ? "admin_internal" : "admin",
      message: message.trim() || "(attachment)",
      media_urls: mediaUrls ?? null,
      is_read: false,
    });

    if (mErr) {
      console.error("[admin ticket reply]", mErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const patch: Record<string, string> = { updated_at: new Date().toISOString() };
    if (nextStatus) patch.status = nextStatus;

    await svc.from("tickets").update(patch).eq("id", ticketId);

    if (!internal) {
      void notifyCustomerPush(ticket.customer_token, {
        title: "Reply from Honey Well",
        body: message.trim().slice(0, 140),
        url: "/home",
        tag: `reply-${ticketId}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
