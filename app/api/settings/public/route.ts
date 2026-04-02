import { getMaintenanceModeViaRest } from "@/lib/maintenance-mode";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

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
  "shop_open",
  "fulfillment_dead_drop_enabled",
  "fulfillment_pickup_enabled",
  "fulfillment_delivery_enabled",
  "maintenance_mode",
  "maintenance_message",
  "maintenance_eta",
  "crypto_network",
  "support_enabled",
] as const;

function parseTruthySetting(v: string | null | undefined): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

/** Merge rows so duplicate keys cannot hide an enabled maintenance or support flag. */
function settingsMapFromRows(rows: { key: string; value: string | null }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key;
    const v = r.value ?? "";
    if (k === "maintenance_mode" || k === "support_enabled") {
      const on = parseTruthySetting(v) || parseTruthySetting(map[k]);
      map[k] = on ? "1" : "0";
    } else {
      map[k] = v;
    }
  }
  return map;
}

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
    shop_open: "1",
    fulfillment_dead_drop_enabled: "1",
    fulfillment_pickup_enabled: "0",
    fulfillment_delivery_enabled: "0",
    maintenance_mode: "0",
    maintenance_message: "Honey Well is currently under maintenance and testing. Please check back later.",
    maintenance_eta: "",
    crypto_network: "",
    support_enabled: "1",
  };
}

export async function GET() {
  try {
    let supabase;
    try {
      supabase = createServiceClient();
    } catch {
      return NextResponse.json(emptyPayload(), { headers: NO_STORE_HEADERS });
    }
    const { data, error } = await supabase.from("settings").select("key, value").in("key", [...KEYS]);

    if (error) {
      console.error("[settings/public]", error);
      return NextResponse.json(emptyPayload(), { headers: NO_STORE_HEADERS });
    }

    const map = settingsMapFromRows(data ?? []);

    const maintenanceFromRest = await getMaintenanceModeViaRest();
    if (maintenanceFromRest !== null) {
      map.maintenance_mode = maintenanceFromRest ? "1" : "0";
    }

    const shopAddress = map.shop_address ?? "";
    const mapsQuery = map.maps_query ?? shopAddress;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
    const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(mapsQuery)}`;

    return NextResponse.json(
      {
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
        shop_open: map.shop_open ?? "1",
        fulfillment_dead_drop_enabled: map.fulfillment_dead_drop_enabled ?? "1",
        fulfillment_pickup_enabled: map.fulfillment_pickup_enabled ?? "0",
        fulfillment_delivery_enabled: map.fulfillment_delivery_enabled ?? "0",
        maintenance_mode: map.maintenance_mode ?? "0",
        maintenance_message:
          map.maintenance_message ??
          "Honey Well is currently under maintenance and testing. Please check back later.",
        maintenance_eta: map.maintenance_eta ?? "",
        crypto_network: map.crypto_network ?? "",
        support_enabled: map.support_enabled ?? "1",
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
