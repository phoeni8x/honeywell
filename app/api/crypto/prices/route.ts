import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COINS = "bitcoin,ethereum,tether";

/** Server-side CoinGecko proxy (no key for basic tier). */
export async function GET() {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COINS}&vs_currencies=eur,huf`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Price fetch failed" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ prices: data, fetched_at: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
