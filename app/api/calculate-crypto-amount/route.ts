import {
  coinGeckoIdFromActive,
  coinSymbolFromActive,
  normalizeActiveCryptoCoin,
} from "@/lib/crypto-coins";
import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HUF_FEE = 1000;

/** GET ?orderId= — expects x-customer-token; returns expected crypto amount in active coin */
export async function GET(request: Request) {
  try {
    const token = getCustomerTokenFromRequest(request);
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    if (!token || !orderId) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, customer_token, total_price")
      .eq("id", orderId)
      .single();

    if (error || !order || order.customer_token !== token) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 404 });
    }

    const totalHuf = Number(order.total_price) + HUF_FEE;

    const { data: coinRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["active_crypto_coin", "crypto_wallet_address", "crypto_network"]);
    const coinMap = Object.fromEntries((coinRows ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    const rawActive =
      coinMap.active_crypto_coin?.trim() || process.env.ACTIVE_CRYPTO_COIN?.trim() || "ethereum";
    const active = normalizeActiveCryptoCoin(rawActive);
    const cgId = coinGeckoIdFromActive(active);

    const cg = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=huf`,
      { next: { revalidate: 30 } }
    );
    if (!cg.ok) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 502 });
    }
    const j = await cg.json();
    const priceHuf = j[cgId]?.huf as number | undefined;
    if (!priceHuf || priceHuf <= 0) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 502 });
    }

    const expected_crypto = totalHuf / priceHuf;
    const wallet =
      coinMap.crypto_wallet_address?.trim() || process.env.CRYPTO_WALLET_ADDRESS?.trim() || "";
    const crypto_network = coinMap.crypto_network?.trim() ?? "";

    return NextResponse.json({
      order_id: orderId,
      total_huf: totalHuf,
      conversion_fee_huf: HUF_FEE,
      coin: active,
      coin_symbol: coinSymbolFromActive(active),
      price_huf_per_coin: priceHuf,
      expected_crypto,
      wallet_address: wallet,
      coin_gecko_id: cgId,
      crypto_network,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
