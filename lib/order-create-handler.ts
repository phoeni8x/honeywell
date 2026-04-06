import { createServiceClient } from "@/lib/supabase/admin";
import { isCustomerBanned } from "@/lib/customer-moderation";
import { notifyAdminPush } from "@/lib/push-notify";
import { sanitizePlainText } from "@/lib/sanitize";
import { isFulfillmentDeadDropCheckoutEnabled } from "@/lib/fulfillment-settings";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { parseShopOpen } from "@/lib/shop-open";
import { notifyTelegramNewOrder } from "@/lib/telegram-order-notify";
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

function prettyCategoryForNotify(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "Product";
  return s
    .split(/[_-\s]+/g)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

const ORDER_ERROR_MESSAGE_MAP: Record<string, string> = {
  invalid_quantity: "Invalid quantity. Please choose at least 1 item.",
  product_not_found: "This product is unavailable right now. Please refresh the shop.",
  insufficient_stock: "Not enough stock for this quantity. Try a smaller amount.",
  guest_no_wallet_spend: "Guests cannot use this wallet option.",
  guest_fulfillment_invalid: "Guests can only use dead drop fulfillment.",
  guest_revolut_forbidden: "Guests cannot pay with bank transfer (VIPs only).",
  guest_crypto_only: "This checkout option is not available for your account. Refresh and try again.",
  dead_drop_unavailable: "No dead drop available right now. Please try again later.",
  pickup_team_only: "Pickup is available for VIPs only.",
  pickup_location_required: "Please choose a pickup point.",
  invalid_pickup_point: "Selected pickup point is invalid or inactive.",
  delivery_team_only: "Delivery is available for VIPs only.",
  delivery_address_required: "Please enter a delivery address.",
  invalid_revolut_pay_timing: "Invalid payment timing. Please retry checkout.",
  pay_on_delivery_disabled: "Pay-on-delivery is no longer available. Choose dead drop and pay now.",
  fulfillment_pickup_delivery_disabled: "Pickup and delivery are no longer available. All orders use dead drop.",
  parcel_locker_disabled_use_booking:
    "Parcel pickup is paused. Submit a booking request instead — no payment until the team confirms.",
  booking_not_when_locker_on: "Booking requests are only available when parcel locker checkout is turned off.",
  preorder_pay_now_required: "Pre-order requires pay-now. Pay-on-delivery is not available.",
  points_min_order_total: "Points can be used only on orders of at least 50,000 HUF.",
  points_insufficient: "You don't have enough points for this order.",
  points_wallet_missing: "Your wallet is not ready yet. Refresh and try again.",
  bees_wallet_missing: "Your wallet is not ready yet. Refresh and try again.",
  insufficient_bees: "You don't have enough Bees for this order.",
  bees_insufficient: "You don't have enough Bees for this order.",
  remainder_payment_invalid: "This payment combination is not valid for this order. Refresh and try again.",
  wallet_required: "Your wallet is not ready yet. Refresh and try again.",
  invalid_payment_method: "Selected payment method is invalid for this order.",
  /** DB not migrated / RPC signature mismatch — safe wording for customers */
  order_backend_misconfigured:
    "Checkout could not complete. The shop may need a quick backend update — please try again later or message support.",
};

const ORDER_RPC_ERROR_CODES = Object.keys(ORDER_ERROR_MESSAGE_MAP) as (keyof typeof ORDER_ERROR_MESSAGE_MAP)[];

function mapCreateOrderRpcError(err: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): { userMessage: string; normalized: string } {
  const blob = [err.message, err.details, err.hint].filter(Boolean).join(" ").toLowerCase();

  if (
    /could not find (the )?function public\.create_order_atomic/i.test(blob) ||
    /could not find a function.*create_order_atomic/i.test(blob) ||
    (/function public\.create_order_atomic/i.test(blob) && /does not exist/i.test(blob)) ||
    (err.code === "42883" && blob.includes("create_order_atomic")) ||
    (String(err.code ?? "").toUpperCase() === "PGRST202" && blob.includes("create_order_atomic"))
  ) {
    return {
      userMessage: ORDER_ERROR_MESSAGE_MAP.order_backend_misconfigured,
      normalized: "order_backend_misconfigured",
    };
  }

  if (blob.trim()) {
    for (const code of ORDER_RPC_ERROR_CODES) {
      const underscored = code as string;
      if (underscored === "order_backend_misconfigured") continue;
      const spaced = underscored.replace(/_/g, " ");
      if (blob.includes(underscored) || blob.includes(spaced)) {
        return { userMessage: ORDER_ERROR_MESSAGE_MAP[underscored], normalized: underscored };
      }
    }
  }

  const raw = String(err.message ?? "").trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, "_");
  if (ORDER_ERROR_MESSAGE_MAP[normalized]) {
    return { userMessage: ORDER_ERROR_MESSAGE_MAP[normalized], normalized };
  }

  return { userMessage: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, normalized: normalized || err.code || "rpc_error" };
}

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
      customer_username,
      booking_without_parcel_locker,
    }: {
      customer_token?: string;
      product_id?: string;
      quantity?: number;
      user_type?: UserType;
      payment_method?: PaymentMethod | string;
      referred_by?: string | null;
      customer_username?: string | null;
      booking_without_parcel_locker?: boolean;
    } & FulfillmentBody = body;

    const token = typeof customer_token === "string" ? customer_token.trim() : "";
    if (!token || !product_id || !quantity || !user_type || !payment_method) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    if (await isCustomerBanned(token)) {
      return NextResponse.json({ error: "Your account is currently blocked. Please contact support." }, { status: 403 });
    }
    if (quantity < 1) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    if (user_type !== "team_member" && user_type !== "guest") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const pm = payment_method as string;
    const bookingWithoutParcelLocker = booking_without_parcel_locker === true;
    const allowedPm = ["revolut", "crypto", "bees", "points", "booking"];
    if (!allowedPm.includes(pm)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    if (user_type === "guest" && pm === "revolut") {
      console.warn("[order] guest attempted revolut", { customer_token: token.slice(0, 8) });
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }
    if (user_type === "guest" && !["crypto", "points", "bees", "booking"].includes(pm)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }

    const bUsed = typeof bees_used === "number" && bees_used > 0 ? bees_used : 0;
    const pUsed = typeof points_used === "number" && points_used > 0 ? Math.floor(points_used) : 0;

    const ftRaw = fulfillment_type as string | undefined;
    if (ftRaw === "pickup" || ftRaw === "delivery") {
      return NextResponse.json(
        { error: ORDER_ERROR_MESSAGE_MAP.fulfillment_pickup_delivery_disabled },
        { status: 400 }
      );
    }
    const ft = ftRaw && ftRaw !== "" ? ftRaw : "dead_drop";
    if (ft !== "dead_drop") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const refCode = referred_by ? sanitizePlainText(referred_by, 32) : "";
    const customerUsernameRaw =
      typeof customer_username === "string"
        ? customer_username.trim().replace(/^@/, "").toLowerCase()
        : "";
    const customerUsername = customerUsernameRaw
      ? sanitizePlainText(customerUsernameRaw, 64)
      : null;

    let revolutTimingParam: string | null = null;
    if (typeof revolut_pay_timing === "string" && revolut_pay_timing === "pay_on_delivery") {
      return NextResponse.json({ error: ORDER_ERROR_MESSAGE_MAP.pay_on_delivery_disabled }, { status: 400 });
    }
    if (typeof revolut_pay_timing === "string" && revolut_pay_timing === "pay_now") {
      revolutTimingParam = revolut_pay_timing;
    }

    const supabase = createServiceClient();

    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["shop_open", "fulfillment_dead_drop_enabled"]);
    const settingsMap = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value])) as Record<
      string,
      string
    >;
    if (!parseShopOpen(settingsMap.shop_open)) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 403 });
    }

    const lockerCheckoutEnabled = isFulfillmentDeadDropCheckoutEnabled(settingsMap.fulfillment_dead_drop_enabled);
    if (bookingWithoutParcelLocker && lockerCheckoutEnabled) {
      return NextResponse.json(
        { error: ORDER_ERROR_MESSAGE_MAP.booking_not_when_locker_on, code: "booking_not_when_locker_on" },
        { status: 400 }
      );
    }
    if (!lockerCheckoutEnabled && !bookingWithoutParcelLocker) {
      return NextResponse.json(
        { error: ORDER_ERROR_MESSAGE_MAP.parcel_locker_disabled_use_booking, code: "parcel_locker_disabled_use_booking" },
        { status: 409 }
      );
    }
    if (bookingWithoutParcelLocker && pm !== "booking") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    if (!bookingWithoutParcelLocker && pm === "booking") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_order_atomic", {
      p_customer_token: token,
      p_product_id: product_id,
      p_quantity: quantity,
      p_user_type: user_type,
      p_payment_method: pm,
      p_fulfillment_type: ft,
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
      p_booking_without_parcel_locker: bookingWithoutParcelLocker,
    });

    if (error) {
      const err = error as { message?: string; code?: string; details?: string; hint?: string };
      const { userMessage, normalized } = mapCreateOrderRpcError(err);
      console.error("[create_order_atomic]", {
        message: String(err.message ?? "").trim(),
        code: err.code,
        details: err.details,
        hint: err.hint,
        mapped: normalized,
      });
      return NextResponse.json(
        { error: userMessage, code: normalized || err.code || "rpc_error" },
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

    if (customerUsername) {
      await supabase
        .from("orders")
        .update({ customer_username: customerUsername })
        .eq("id", orderId);
    }

    /** Telegram WebApp guests use tg_<id> but may not send customer_username; resolve from verifications. */
    let resolvedTelegramUsername: string | null = null;
    if (token.startsWith("tg_")) {
      const tgId = Number(token.slice(3));
      if (Number.isFinite(tgId) && tgId > 0) {
        const { data: tv } = await supabase
          .from("telegram_verifications")
          .select("telegram_username")
          .eq("telegram_user_id", tgId)
          .maybeSingle();
        const rawU = typeof tv?.telegram_username === "string" ? tv.telegram_username.trim() : "";
        const normalized = rawU.replace(/^@/, "").toLowerCase();
        if (normalized) {
          const safe = sanitizePlainText(normalized, 64);
          if (safe) {
            resolvedTelegramUsername = safe;
            if (!customerUsername) {
              await supabase.from("orders").update({ customer_username: safe }).eq("id", orderId);
            }
          }
        }
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

    const { data: createdOrder, error: createdOrderFetchErr } = await supabase
      .from("orders")
      .select(
        "order_number, fulfillment_type, payment_method, customer_username, delivery_address, total_price, payment_reference_code, products(name, category)",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (createdOrderFetchErr) {
      console.error("[order create] load order for notify", createdOrderFetchErr);
    }

    type ProductEmbed = { name?: string | null; category?: string | null };
    const rawEmbed = createdOrder?.products as ProductEmbed | ProductEmbed[] | null | undefined;
    const productRow: ProductEmbed | null = Array.isArray(rawEmbed) ? (rawEmbed[0] ?? null) : (rawEmbed ?? null);

    let productTypeForNotify: string | null = null;
    if (productRow?.name?.trim()) {
      const n = productRow.name.trim();
      const cat = productRow.category?.trim();
      productTypeForNotify = cat ? `${n} (${prettyCategoryForNotify(cat)})` : n;
    } else if (productRow?.category?.trim()) {
      productTypeForNotify = prettyCategoryForNotify(productRow.category);
    }
    if (!productTypeForNotify) {
      const { data: prodFallback } = await supabase
        .from("products")
        .select("name, category")
        .eq("id", product_id)
        .maybeSingle();
      const name = typeof prodFallback?.name === "string" ? prodFallback.name.trim() : "";
      const cat = typeof prodFallback?.category === "string" ? prodFallback.category.trim() : "";
      if (name) {
        productTypeForNotify = cat ? `${name} (${prettyCategoryForNotify(cat)})` : name;
      } else if (cat) {
        productTypeForNotify = prettyCategoryForNotify(cat);
      }
    }

    const orderLabel =
      (createdOrder?.order_number as string | null | undefined) ?? orderId.slice(0, 8);
    const fulfill = (createdOrder?.fulfillment_type as string | null | undefined) ?? "—";
    const pay = (createdOrder?.payment_method as string | null | undefined) ?? "—";
    void notifyAdminPush({
      title: bookingWithoutParcelLocker ? "New booking request" : "New order placed",
      body: `${orderLabel} · ${fulfill} · ${pay}`,
      url: "/admin-080209?tab=orders",
      tag: `new-order-${orderId}`,
    });
    const usernameForNotify =
      (createdOrder?.customer_username as string | null | undefined) ??
      customerUsername ??
      resolvedTelegramUsername ??
      null;
    void notifyTelegramNewOrder({
      orderId,
      customerUsername: usernameForNotify,
      deliveryAddress: (createdOrder?.delivery_address as string | null | undefined) ?? null,
      orderAmount: (createdOrder?.total_price as number | string | null | undefined) ?? null,
      productType: productTypeForNotify,
      paymentReferenceCode: (createdOrder?.payment_reference_code as string | null | undefined) ?? null,
      bookingWithoutPayment: bookingWithoutParcelLocker,
    });

    const res = NextResponse.json({
      order_id: orderId,
      payment_reference_code: (createdOrder?.payment_reference_code as string | null | undefined) ?? null,
    });
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
