import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { sanitizePlainText } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = request.headers.get("x-customer-token");
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("customer_token", token)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[tickets GET]", error);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }

  return NextResponse.json({ tickets: rows ?? [] });
}

export async function POST(request: Request) {
  const token = request.headers.get("x-customer-token");
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  try {
    const body = await request.json();
    const subject = sanitizePlainText(String(body.subject ?? ""), 200);
    const message = sanitizePlainText(String(body.message ?? ""), 8000);
    const category = sanitizePlainText(String(body.category ?? "other"), 40);
    const orderId = typeof body.order_id === "string" ? body.order_id : null;

    if (!subject.trim() || !message.trim()) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const allowed = ["order", "payment", "pickup", "product", "other"];
    const cat = allowed.includes(category) ? category : "other";

    const supabase = createServiceClient();

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

    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .insert({
        customer_token: token,
        subject: subject.trim(),
        category: cat,
        order_id: orderId,
        status: "open",
      })
      .select("*")
      .single();

    if (tErr || !ticket) {
      console.error("[tickets POST]", tErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    const { error: mErr } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender: "customer",
      message: message.trim(),
    });

    if (mErr) {
      console.error("[tickets POST message]", mErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    await supabase
      .from("tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticket.id);

    return NextResponse.json({ ticket });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
