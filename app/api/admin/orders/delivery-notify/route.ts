import { requireAdminUser } from "@/lib/admin-auth";
import { notifyCustomerPush } from "@/lib/push-notify";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Kind = "ten_min" | "delay" | "arrived" | "custom_eta";

function buildMessage(kind: Kind, orderLabel: string, minutes?: number): string {
  if (kind === "ten_min") return `Order ${orderLabel}: driver is around 10 minutes away.`;
  if (kind === "delay") return `Order ${orderLabel}: slight delay on the way. Thanks for your patience.`;
  if (kind === "arrived") return `Order ${orderLabel}: driver has arrived.`;
  const safeMin = Number(minutes ?? 0);
  if (safeMin > 0) return `Order ${orderLabel}: driver is around ${safeMin} minutes away.`;
  return `Order ${orderLabel}: delivery update available.`;
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      order_id?: string;
      kind?: Kind;
      minutes?: number;
    };
    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    const kind = body.kind;
    const minutes = Number(body.minutes ?? 0);

    if (!orderId || !kind || !["ten_min", "delay", "arrived", "custom_eta"].includes(kind)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    if (kind === "custom_eta" && (!Number.isFinite(minutes) || minutes <= 0 || minutes > 300)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const svc = createServiceClient();
    const { data: order, error: orderErr } = await svc
      .from("orders")
      .select("id, customer_token, order_number, status, fulfillment_type")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order || order.fulfillment_type !== "delivery") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }

    const customerToken = typeof order.customer_token === "string" ? order.customer_token : "";
    if (!customerToken) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const orderLabel = (order.order_number as string | null) ?? orderId.slice(0, 8);
    void notifyCustomerPush(customerToken, {
      title: "Delivery update",
      body: buildMessage(kind, orderLabel, minutes),
      url: `/account/orders/${orderId}/track`,
      tag: `delivery-note-${orderId}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
