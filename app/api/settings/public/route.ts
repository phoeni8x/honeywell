import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KEYS = [
  "revolut_payment_link",
  "crypto_wallet_address",
  "shop_address",
  "maps_query",
  "hero_tagline",
  "active_crypto_coin",
  "crypto_tutorial_video_url",
  "crypto_wallet_app_name",
  "crypto_wallet_app_url",
  "crypto_exchange_name",
  "crypto_exchange_url",
  "shop_currency",
] as const;

function emptyPayload() {
  const shopAddress = "";
  const mapsQuery = shopAddress;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(mapsQuery)}`;
  return {
    revolut_payment_link: "",
    crypto_wallet_address: "",
    shop_address: shopAddress,
    google_maps_url: googleMapsUrl,
    apple_maps_url: appleMapsUrl,
    hero_tagline: "",
    active_crypto_coin: "ethereum",
    crypto_tutorial_video_url: "",
    crypto_wallet_app_name: "",
    crypto_wallet_app_url: "",
    crypto_exchange_name: "",
    crypto_exchange_url: "",
    shop_currency: "HUF",
  };
}

export async function GET() {
  try {
    let supabase;
    try {
      supabase = createServiceClient();
    } catch {
      return NextResponse.json(emptyPayload());
    }
    const { data, error } = await supabase.from("settings").select("key, value").in("key", [...KEYS]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;

    const shopAddress = map.shop_address ?? "";
    const mapsQuery = map.maps_query ?? shopAddress;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
    const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(mapsQuery)}`;

    return NextResponse.json({
      revolut_payment_link: map.revolut_payment_link ?? "",
      crypto_wallet_address: map.crypto_wallet_address ?? "",
      shop_address: shopAddress,
      google_maps_url: googleMapsUrl,
      apple_maps_url: appleMapsUrl,
      hero_tagline: map.hero_tagline ?? "",
      active_crypto_coin: map.active_crypto_coin ?? "ethereum",
      crypto_tutorial_video_url: map.crypto_tutorial_video_url ?? "",
      crypto_wallet_app_name: map.crypto_wallet_app_name ?? "",
      crypto_wallet_app_url: map.crypto_wallet_app_url ?? "",
      crypto_exchange_name: map.crypto_exchange_name ?? "",
      crypto_exchange_url: map.crypto_exchange_url ?? "",
      shop_currency: map.shop_currency ?? "HUF",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
