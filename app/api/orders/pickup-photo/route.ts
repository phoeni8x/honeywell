import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const orderId = form.get("orderId") as string | null;
    const customerToken = form.get("customerToken") as string | null;

    if (!file || !orderId || !customerToken) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, customer_token, status")
      .eq("id", orderId)
      .single();

    if (orderErr || !order || order.customer_token !== customerToken) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "confirmed" && order.status !== "ready_for_pickup") {
      return NextResponse.json({ error: "Order not ready for pickup proof" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${orderId}/${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from("pickup-proofs").upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("pickup-proofs").getPublicUrl(path);

    const { error: updErr } = await supabase
      .from("orders")
      .update({
        pickup_photo_url: publicUrl,
        status: "pickup_submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
