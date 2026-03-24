import { createServiceClient } from "@/lib/supabase/admin";
import { processOrderConfirmed } from "@/lib/order-confirmation-server";
import { sanitizePlainText } from "@/lib/sanitize";
import { parseFulfillmentOptionEnabled } from "@/lib/fulfillment-settings";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { parseShopOpen } from "@/lib/shop-open";
import type { PaymentMethod, UserType } from "@/types";
import { NextResponse } from "next/server";

type FulfillmentBody = {
  fulfillment_type?: string;
  dead_drop_id?: string | null;
  location_id?: string | null;
  delivery_address?: string | null;
  delivery_apartment?: string | null;
  delivery_notes?: string | null;
  delivery_phone?: string | null;
  delivery_lat?: number | null;
  delivery_lon?: number | null;
  bees_used?: number;
  points_used?: number;
  revolut_pay_timing?: string | null;
};

const ORDER_ERROR_MESSAGE_MAP: Record<string, string> = {
  invalid_quantity: "Invalid quantity. Please choose at least 1 item.",
  product_not_found: "This product is unavailable right now. Please refresh the shop.",
  insufficient_stock: "Not enough stock for this quantity. Try a smaller amount.",
  guest_no_wallet_spend: "Guests cannot pay with Bees or Points.",
  guest_fulfillment_invalid: "Guests can only use dead drop fulfillment.",
  guest_revolut_forbidden: "Guests cannot pay with Revolut.",
  dead_drop_required: "Please choose an active dead drop location.",
  dead_drop_inactive: "Selected dead drop is no longer active. Please refresh.",
  pickup_team_only: "Pickup is available for team members only.",
  pickup_location_required: "Please choose a pickup point.",
  invalid_pickup_point: "Selected pickup point is invalid or inactive.",
  delivery_team_only: "Delivery is available for team members only.",
  delivery_address_required: "Please enter a delivery address.",
  invalid_revolut_pay_timing: "Invalid Revolut timing selection. Please retry.",
  points_insufficient: "You don't have enough points for this order.",
  bees_insufficient: "You don't have enough Bees for this order.",
  wallet_required: "Your wallet is not ready yet. Refresh and try again.",
  invalid_payment_method: "Selected payment method is invalid for this order.",
};

export async function handleCreateOrder(request: Request) {
  try {
    const body = await request.json();
    const {
      customer_token,
      product_id,
      quantity,
      user_type,
      payment_method,
      referred_by,
      fulfillment_type,
      dead_drop_id,
      location_id,
      delivery_address,
      delivery_apartment,
      delivery_notes,
      delivery_phone,
      delivery_lat,
      delivery_lon,
      bees_used,
      points_used,
      revolut_pay_timing,
    }: {
      customer_token?: string;
      product_id?: string;
      quantity?: number;
      user_type?: UserType;
      payment_method?: PaymentMethod | string;
      referred_by?: string | null;
    } & FulfillmentBody = body;

    const token = typeof customer_token === "string" ? customer_token.trim() : "";
    if (!token || !product_id || !quantity || !user_type || !payment_method) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    if (quantity < 1) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    if (user_type !== "team_member" && user_type !== "guest") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const pm = payment_method as string;
    const allowedPm = ["revolut", "crypto", "bees", "points"];
    if (!allowedPm.includes(pm)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    if (user_type === "guest" && pm === "revolut") {
      console.warn("[order] guest attempted revolut", { customer_token: token.slice(0, 8) });
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }
    if (user_type === "guest" && pm !== "crypto") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }

    const bUsed = typeof bees_used === "number" && bees_used > 0 ? bees_used : 0;
    const pUsed = typeof points_used === "number" && points_used > 0 ? Math.floor(points_used) : 0;

    if (user_type === "guest" && (bUsed > 0 || pUsed > 0)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }

    const ft = fulfillment_type as string | undefined;
    if (ft && !["dead_drop", "pickup", "delivery"].includes(ft)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    if (user_type === "guest" && ft && (ft === "pickup" || ft === "delivery")) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }

    const refCode = referred_by ? sanitizePlainText(referred_by, 32) : "";

    let revolutTimingParam: string | null = null;
    if (
      typeof revolut_pay_timing === "string" &&
      (revolut_pay_timing === "pay_now" || revolut_pay_timing === "pay_on_delivery")
    ) {
      revolutTimingParam = revolut_pay_timing;
    }

    const supabase = createServiceClient();

    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "shop_open",
        "fulfillment_dead_drop_enabled",
        "fulfillment_pickup_enabled",
        "fulfillment_delivery_enabled",
      ]);
    const settingsMap = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value])) as Record<
      string,
      string
    >;
    if (!parseShopOpen(settingsMap.shop_open)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }

    if (ft === "dead_drop" && !parseFulfillmentOptionEnabled(settingsMap.fulfillment_dead_drop_enabled)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }
    if (ft === "pickup" && !parseFulfillmentOptionEnabled(settingsMap.fulfillment_pickup_enabled)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }
    if (ft === "delivery" && !parseFulfillmentOptionEnabled(settingsMap.fulfillment_delivery_enabled)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("create_order_atomic", {
      p_customer_token: token,
      p_product_id: product_id,
      p_quantity: quantity,
      p_user_type: user_type,
      p_payment_method: pm,
      p_fulfillment_type: ft ?? null,
      p_dead_drop_id: dead_drop_id ?? null,
      p_location_id: location_id ?? null,
      p_delivery_address: delivery_address ? sanitizePlainText(delivery_address, 500) : null,
      p_delivery_apartment: delivery_apartment ? sanitizePlainText(delivery_apartment, 200) : null,
      p_delivery_notes: delivery_notes ? sanitizePlainText(delivery_notes, 500) : null,
      p_delivery_phone: delivery_phone ? sanitizePlainText(delivery_phone, 40) : null,
      p_delivery_lat: delivery_lat ?? null,
      p_delivery_lon: delivery_lon ?? null,
      p_bees_used: bUsed,
      p_points_used: pUsed,
      p_revolut_pay_timing: revolutTimingParam,
    });

    if (error) {
      const err = error as { message?: string; code?: string; details?: string; hint?: string };
      const raw = String(err.message ?? "").trim();
      const normalized = raw.toLowerCase().replace(/\s+/g, "_");
      const safeError = ORDER_ERROR_MESSAGE_MAP[normalized] ?? PUBLIC_ERROR_TRY_AGAIN_OR_GUEST;
      console.error("[create_order_atomic]", {
        message: raw,
        code: err.code,
        details: err.details,
        hint: err.hint,
      });
      return NextResponse.json(
        { error: safeError, code: normalized || err.code || "rpc_error" },
        { status: 400 }
      );
    }

    const orderId =
      typeof data === "string"
        ? data
        : data != null
          ? String(data)
          : "";
    if (!orderId) {
      console.error("[create_order_atomic] empty return data", data);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, code: "empty_order_id" }, { status: 500 });
    }

    const { data: ord } = await supabase.from("orders").select("status").eq("id", orderId).single();
    if (ord?.status === "confirmed" || ord?.status === "waiting") {
      try {
        await processOrderConfirmed(orderId);
      } catch (postErr) {
        console.error("[processOrderConfirmed] non-fatal", postErr);
      }
    }

    if (refCode) {
      try {
        await supabase.from("orders").update({ referral_code_used: refCode }).eq("id", orderId);

        const { count } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_token", token);

        if (count === 1) {
          const { data: refWallet } = await supabase
            .from("bees_wallets")
            .select("customer_token")
            .eq("referral_code", refCode)
            .maybeSingle();

          if (refWallet?.customer_token && refWallet.customer_token !== token) {
            await supabase.from("referrals").insert({
              referrer_token: refWallet.customer_token,
              referee_token: token,
              referral_code: refCode,
              first_order_id: orderId,
              status: "pending",
            });
          }
        }
      } catch (refErr) {
        console.error("[order referral]", refErr);
      }
    }

    const res = NextResponse.json({ order_id: orderId });
    const host = request.headers.get("host")?.split(":")[0] ?? "";
    const secure = request.headers.get("x-forwarded-proto") === "https" || host !== "localhost";
    const cookieDomain = host.endsWith("teamruby.net") ? ".teamruby.net" : undefined;
    res.cookies.set("honeywell_customer_token", token, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure,
      maxAge: 60 * 60 * 24 * 400,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
