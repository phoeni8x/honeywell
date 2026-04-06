import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingFallbackResult =
  | { ok: true; orderId: string }
  | { ok: false; code: string };

/**
 * When `create_order_atomic` is missing or PostgREST cannot resolve it (unmigrated DB),
 * insert a booking row using the same business rules as the SQL booking branch:
 * payment_method booking, status pre_ordered, dead_drop, defer stock, no wallet spend.
 */
export async function tryInsertBookingOrderWhenRpcMissing(
  supabase: SupabaseClient,
  input: {
    customerToken: string;
    productId: string;
    quantity: number;
    userType: "guest" | "team_member";
  },
): Promise<BookingFallbackResult> {
  const { customerToken, productId, quantity, userType } = input;
  if (quantity < 1) return { ok: false, code: "invalid_quantity" };

  const { data: row, error: selErr } = await supabase
    .from("products")
    .select("stock_quantity, price_regular, price_team_member, allow_preorder, is_active")
    .eq("id", productId)
    .maybeSingle();

  if (selErr || !row) return { ok: false, code: "product_not_found" };
  if (!row.is_active) return { ok: false, code: "product_not_found" };

  const unit = userType === "team_member" ? Number(row.price_team_member) : Number(row.price_regular);
  if (!Number.isFinite(unit) || unit < 0) return { ok: false, code: "product_not_found" };

  const stock = Number(row.stock_quantity);
  const allowPreorder = Boolean(row.allow_preorder);
  if (!allowPreorder && stock < quantity) return { ok: false, code: "insufficient_stock" };

  const totalPrice = unit * quantity;

  const { data: refRaw, error: refErr } = await supabase.rpc("generate_payment_reference_code");
  if (refErr || refRaw == null || String(refRaw).trim() === "") {
    console.error("[booking fallback] generate_payment_reference_code", refErr);
    return { ok: false, code: "order_backend_misconfigured" };
  }
  const paymentRef = String(refRaw).trim();

  const { data: inserted, error: insErr } = await supabase
    .from("orders")
    .insert({
      customer_token: customerToken,
      product_id: productId,
      quantity,
      total_price: totalPrice,
      user_type: userType,
      payment_method: "booking",
      status: "pre_ordered",
      fulfillment_type: "dead_drop",
      dead_drop_id: null,
      bees_used: 0,
      points_used: 0,
      pay_now_payment_confirmed: false,
      defer_stock_until_approval: true,
      payment_reference_code: paymentRef,
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    console.error("[booking fallback] orders.insert", insErr);
    return { ok: false, code: "order_backend_misconfigured" };
  }

  return { ok: true, orderId: inserted.id as string };
}

export function isCreateOrderAtomicRpcLikelyMissing(err: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}): boolean {
  const blob = [err.message, err.details, err.hint].filter(Boolean).join(" ").toLowerCase();
  if (String(err.code ?? "").toUpperCase() === "PGRST202") return true;
  if (/could not find (the )?function public\.create_order_atomic/i.test(blob)) return true;
  if (/could not find a function.*create_order_atomic/i.test(blob)) return true;
  if (/function public\.create_order_atomic/i.test(blob) && /does not exist/i.test(blob)) return true;
  if (err.code === "42883" && blob.includes("create_order_atomic")) return true;
  return false;
}
