import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HUF_FEE = 1000;

function coinGeckoId(active: string) {
  const m: Record<string, string> = {
    ethereum: "ethereum",
    bitcoin: "bitcoin",
    tether: "tether",
    "usd-coin": "usd-coin",
  };
  return m[active] ?? "ethereum";
}

/** GET ?orderId= — expects x-customer-token; returns expected crypto amount in active coin */
export async function GET(request: Request) {
  try {
    const token = request.headers.get("x-customer-token");
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    if (!token || !orderId) {
      return NextResponse.json({ error: "Missing token or orderId" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, customer_token, total_price")
      .eq("id", orderId)
      .single();

    if (error || !order || order.customer_token !== token) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const totalHuf = Number(order.total_price) + HUF_FEE;
    const active = process.env.ACTIVE_CRYPTO_COIN ?? "ethereum";
    const cgId = coinGeckoId(active);

    const cg = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=huf`,
      { next: { revalidate: 30 } }
    );
    if (!cg.ok) {
      return NextResponse.json({ error: "Could not load coin price" }, { status: 502 });
    }
    const j = await cg.json();
    const priceHuf = j[cgId]?.huf as number | undefined;
    if (!priceHuf || priceHuf <= 0) {
      return NextResponse.json({ error: "Invalid HUF price" }, { status: 502 });
    }

    const expected_crypto = totalHuf / priceHuf;
    const wallet = process.env.CRYPTO_WALLET_ADDRESS ?? "";

    return NextResponse.json({
      order_id: orderId,
      total_huf: totalHuf,
      conversion_fee_huf: HUF_FEE,
      coin: active,
      coin_gecko_id: cgId,
      price_huf_per_coin: priceHuf,
      expected_crypto,
      wallet_address: wallet,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
