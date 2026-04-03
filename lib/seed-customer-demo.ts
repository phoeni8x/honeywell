import { generatePaymentReferenceCodeClient } from "@/lib/payment-reference";
import { createServiceClient } from "@/lib/supabase/admin";
import { notifyTelegramNewOrder } from "@/lib/telegram-order-notify";

const DEMO_ORDER_MARKER = "__HW_DEMO__";
const DEMO_TICKET_SUBJECT_PREFIX = "[HW Demo]";

export type SeedCustomerDemoResult =
  | {
      ok: true;
      orders: { id: string; order_number?: string | null; status: string }[];
      tickets: { id: string; ticket_number: string; subject: string }[];
    }
  | { ok: false; error: string };

/**
 * Inserts two demo orders and two demo support threads for `customerToken`.
 * Removes any previous demo rows for this token (orders marked with referral_code_used,
 * tickets whose subject starts with "[HW Demo]").
 * Does not change product stock (direct inserts).
 */
export async function seedCustomerDemoData(customerToken: string): Promise<SeedCustomerDemoResult> {
  const supabase = createServiceClient();

  const demoCustomerUsername = `mock_customer_${customerToken.slice(0, 6)}`;
  const demoDeliveryAddress = "Demo — /account seed (same Telegram format as a real purchase)";

  await supabase
    .from("orders")
    .delete()
    .eq("customer_token", customerToken)
    .eq("referral_code_used", DEMO_ORDER_MARKER);

  const { data: oldTickets } = await supabase
    .from("tickets")
    .select("id")
    .eq("customer_token", customerToken)
    .like("subject", `${DEMO_TICKET_SUBJECT_PREFIX}%`);

  if (oldTickets?.length) {
    await supabase.from("tickets").delete().in(
      "id",
      oldTickets.map((t) => t.id)
    );
  }

  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, price_regular, category")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (pErr || !product) {
    return { ok: false, error: "no_active_product" };
  }

  const unit = Number(product.price_regular);
  const productType = typeof product.category === "string" ? product.category : null;
  const now = new Date().toISOString();

  const { data: o1, error: e1 } = await supabase
    .from("orders")
    .insert({
      customer_token: customerToken,
      product_id: product.id,
      quantity: 1,
      total_price: unit,
      user_type: "guest",
      payment_method: "crypto",
      status: "delivered",
      payment_reference_code: generatePaymentReferenceCodeClient(),
      referral_code_used: DEMO_ORDER_MARKER,
      updated_at: now,
    })
    .select("id, order_number, status, payment_reference_code")
    .single();

  if (e1 || !o1) {
    console.error("[seed demo order 1]", e1);
    return { ok: false, error: "order_insert_failed" };
  }
  await notifyTelegramNewOrder({
    orderId: o1.id,
    customerUsername: demoCustomerUsername,
    deliveryAddress: demoDeliveryAddress,
    orderAmount: unit,
    productType,
    paymentReferenceCode: (o1.payment_reference_code as string | null) ?? null,
    banner: "🧪 Demo purchase test — uses your current TELEGRAM_BOT_TOKEN (not a live checkout).",
  });

  const { data: o2, error: e2 } = await supabase
    .from("orders")
    .insert({
      customer_token: customerToken,
      product_id: product.id,
      quantity: 2,
      total_price: unit * 2,
      user_type: "guest",
      payment_method: "crypto",
      status: "confirmed",
      payment_reference_code: generatePaymentReferenceCodeClient(),
      referral_code_used: DEMO_ORDER_MARKER,
      updated_at: now,
    })
    .select("id, order_number, status, payment_reference_code")
    .single();

  if (e2 || !o2) {
    console.error("[seed demo order 2]", e2);
    return { ok: false, error: "order_insert_failed" };
  }
  await notifyTelegramNewOrder({
    orderId: o2.id,
    customerUsername: demoCustomerUsername,
    deliveryAddress: demoDeliveryAddress,
    orderAmount: unit * 2,
    productType,
    paymentReferenceCode: (o2.payment_reference_code as string | null) ?? null,
    banner: "🧪 Demo purchase test #2 — same Telegram format as production.",
  });

  const ordersOut = [
    { id: o1.id, order_number: o1.order_number, status: o1.status },
    { id: o2.id, order_number: o2.order_number, status: o2.status },
  ];

  const { data: t1, error: tErr1 } = await supabase
    .from("tickets")
    .insert({
      customer_token: customerToken,
      order_id: o1.id,
      subject: `${DEMO_TICKET_SUBJECT_PREFIX} Linked to demo order`,
      category: "order",
      status: "open",
    })
    .select("id, ticket_number, subject")
    .single();

  if (tErr1 || !t1) {
    console.error("[seed demo ticket 1]", tErr1);
    return { ok: false, error: "ticket_insert_failed" };
  }

  await supabase.from("ticket_messages").insert([
    {
      ticket_id: t1.id,
      sender: "customer",
      message:
        "This is a demo support message. You should see it after reload. (HW system check)",
    },
    {
      ticket_id: t1.id,
      sender: "admin",
      message:
        "Demo reply: support + order link are working. You can reply from this thread.",
    },
  ]);

  const { data: t2, error: tErr2 } = await supabase
    .from("tickets")
    .insert({
      customer_token: customerToken,
      subject: `${DEMO_TICKET_SUBJECT_PREFIX} General question`,
      category: "other",
      status: "in_progress",
    })
    .select("id, ticket_number, subject")
    .single();

  if (tErr2 || !t2) {
    console.error("[seed demo ticket 2]", tErr2);
    return { ok: false, error: "ticket_insert_failed" };
  }

  await supabase.from("ticket_messages").insert({
    ticket_id: t2.id,
    sender: "customer",
    message: "Second demo ticket — in progress. Reload Support to confirm it persists.",
  });

  await supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", t1.id);
  await supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", t2.id);

  return {
    ok: true,
    orders: ordersOut,
    tickets: [
      { id: t1.id, ticket_number: t1.ticket_number, subject: t1.subject },
      { id: t2.id, ticket_number: t2.ticket_number, subject: t2.subject },
    ],
  };
}
