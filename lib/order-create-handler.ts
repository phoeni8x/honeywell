import { createServiceClient } from "@/lib/supabase/admin";
import { processOrderConfirmed } from "@/lib/order-confirmation-server";
import { sanitizePlainText } from "@/lib/sanitize";
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
    }: {
      customer_token?: string;
      product_id?: string;
      quantity?: number;
      user_type?: UserType;
      payment_method?: PaymentMethod | string;
      referred_by?: string | null;
    } & FulfillmentBody = body;

    if (!customer_token || !product_id || !quantity || !user_type || !payment_method) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (quantity < 1) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    if (user_type !== "team_member" && user_type !== "guest") {
      return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
    }

    const pm = payment_method as string;
    const allowedPm = ["revolut", "crypto", "bees", "points"];
    if (!allowedPm.includes(pm)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    if (user_type === "guest" && pm === "revolut") {
      console.warn("[order] guest attempted revolut", { customer_token: customer_token?.slice(0, 8) });
      return NextResponse.json({ error: "Revolut is for team members only" }, { status: 403 });
    }
    if (user_type === "guest" && !["crypto", "bees", "points"].includes(pm)) {
      return NextResponse.json({ error: "Invalid payment method for guests" }, { status: 400 });
    }

    const ft = fulfillment_type as string | undefined;
    if (ft && !["dead_drop", "pickup", "delivery"].includes(ft)) {
      return NextResponse.json({ error: "Invalid fulfillment type" }, { status: 400 });
    }
    if (user_type === "guest" && ft && (ft === "pickup" || ft === "delivery")) {
      return NextResponse.json({ error: "This fulfillment option is for team members only" }, { status: 403 });
    }

    const bUsed = typeof bees_used === "number" && bees_used > 0 ? bees_used : 0;
    const pUsed = typeof points_used === "number" && points_used > 0 ? Math.floor(points_used) : 0;

    const refCode = referred_by ? sanitizePlainText(referred_by, 32) : "";

    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("create_order_atomic", {
      p_customer_token: customer_token,
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
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("insufficient_stock")) {
        return NextResponse.json({ error: "Not enough stock" }, { status: 409 });
      }
      if (msg.includes("product_not_found")) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      if (msg.includes("guest_revolut_forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (msg.includes("guest_fulfillment_invalid") || msg.includes("pickup_team_only") || msg.includes("delivery_team_only")) {
        return NextResponse.json({ error: "This fulfillment option is for team members only" }, { status: 403 });
      }
      if (msg.includes("remainder_payment_invalid")) {
        return NextResponse.json(
          { error: "Use Revolut or Crypto to pay any remaining balance after Bees/Points." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const orderId = data as string;

    const { data: ord } = await supabase.from("orders").select("status").eq("id", orderId).single();
    if (ord?.status === "confirmed") {
      await processOrderConfirmed(orderId);
    }

    if (refCode) {
      await supabase.from("orders").update({ referral_code_used: refCode }).eq("id", orderId);
    }

    if (refCode) {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_token", customer_token);

      if (count === 1) {
        const { data: refWallet } = await supabase
          .from("bees_wallets")
          .select("customer_token")
          .eq("referral_code", refCode)
          .maybeSingle();

        if (refWallet?.customer_token && refWallet.customer_token !== customer_token) {
          await supabase.from("referrals").insert({
            referrer_token: refWallet.customer_token,
            referee_token: customer_token,
            referral_code: refCode,
            first_order_id: orderId,
            status: "pending",
          });
        }
      }
    }

    return NextResponse.json({ order_id: orderId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
