import { COINGECKO_IDS_ALL } from "@/lib/crypto-coins";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Server-side CoinGecko proxy (no key for basic tier). */
export async function GET() {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS_ALL}&vs_currencies=eur,huf`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ prices: data, fetched_at: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
