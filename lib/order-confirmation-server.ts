import { createServiceClient } from "@/lib/supabase/admin";
import { basePointsFromOrderHuf, calculateLevel, pointsWithLevelBonus } from "@/lib/levels";

const MIN_REFERRAL_BEES = 0.05;

export type ProcessOrderConfirmedResult = {
  ok: boolean;
  /** Points earned for this order (earn transaction). */
  pointsEarned?: number;
  previousLevel?: number;
  newLevel?: number;
  leveledUp?: boolean;
};

/** Run after order is set to `confirmed`. Idempotent per order for points. */
export async function processOrderConfirmed(orderId: string): Promise<ProcessOrderConfirmedResult> {
  const supabase = createServiceClient();

  const { data: existingPt } = await supabase
    .from("points_transactions")
    .select("id")
    .eq("order_id", orderId)
    .eq("type", "earn")
    .maybeSingle();

  if (existingPt) {
    const { data: ord } = await supabase.from("orders").select("customer_token").eq("id", orderId).maybeSingle();
    const token = ord?.customer_token as string | undefined;
    if (token) {
      const { data: w } = await supabase
        .from("points_wallets")
        .select("buyer_level")
        .eq("customer_token", token)
        .maybeSingle();
      const lv = w?.buyer_level ?? 1;
      return { ok: true, pointsEarned: 0, previousLevel: lv, newLevel: lv, leveledUp: false };
    }
    return { ok: true, pointsEarned: 0, previousLevel: 1, newLevel: 1, leveledUp: false };
  }

  const { data: order, error: oErr } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (oErr || !order || (order.status !== "confirmed" && order.status !== "waiting")) {
    return { ok: false };
  }

  const customerToken = order.customer_token as string;
  const totalHuf = Number(order.total_price);

  const { data: wallet } = await supabase
    .from("points_wallets")
    .select("*")
    .eq("customer_token", customerToken)
    .maybeSingle();

  const previousLevel = wallet?.buyer_level ?? 1;

  const totalOrders = (wallet?.total_orders ?? 0) + 1;
  const totalSpent = Number(wallet?.total_spent_huf ?? 0) + totalHuf;
  const newLevel = calculateLevel(totalOrders, totalSpent);

  const base = basePointsFromOrderHuf(totalHuf);
  const pts = pointsWithLevelBonus(base, newLevel);

  if (wallet) {
    await supabase
      .from("points_wallets")
      .update({
        balance_points: (wallet.balance_points ?? 0) + pts,
        lifetime_points: (wallet.lifetime_points ?? 0) + pts,
        total_orders: totalOrders,
        total_spent_huf: totalSpent,
        buyer_level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("customer_token", customerToken);
  } else {
    await supabase.from("points_wallets").insert({
      customer_token: customerToken,
      balance_points: pts,
      lifetime_points: pts,
      total_orders: totalOrders,
      total_spent_huf: totalSpent,
      buyer_level: newLevel,
    });
  }

  await supabase.from("points_transactions").insert({
    customer_token: customerToken,
    type: "earn",
    points: pts,
    order_id: orderId,
  });

  await supabase.from("orders").update({ points_earned: pts }).eq("id", orderId);

  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("first_order_id", orderId)
    .eq("status", "pending")
    .maybeSingle();

  if (referral) {
    const rewardBees = (totalHuf * 0.05) / 10_000;
    if (rewardBees >= MIN_REFERRAL_BEES) {
      const referrerToken = referral.referrer_token as string;

      const { data: rw } = await supabase.from("bees_wallets").select("balance_bees").eq("customer_token", referrerToken).maybeSingle();
      const bal = Number(rw?.balance_bees ?? 0);
      if (rw) {
        await supabase
          .from("bees_wallets")
          .update({
            balance_bees: bal + rewardBees,
            updated_at: new Date().toISOString(),
          })
          .eq("customer_token", referrerToken);
      } else {
        await supabase.from("bees_wallets").insert({
          customer_token: referrerToken,
          balance_bees: rewardBees,
        });
      }

      await supabase.from("bees_transactions").insert({
        customer_token: referrerToken,
        type: "bonus",
        amount_bees: rewardBees,
        amount_huf: totalHuf * 0.05,
        payment_method: "referral",
        reference: orderId,
      });

      await supabase
        .from("referrals")
        .update({
          status: "rewarded",
          reward_bees: rewardBees,
          rewarded_at: new Date().toISOString(),
        })
        .eq("id", referral.id);

      const bonusReferee = 500;
      const { data: wRef } = await supabase.from("points_wallets").select("*").eq("customer_token", customerToken).maybeSingle();
      if (wRef) {
        await supabase
          .from("points_wallets")
          .update({
            balance_points: (wRef.balance_points ?? 0) + bonusReferee,
            lifetime_points: (wRef.lifetime_points ?? 0) + bonusReferee,
            updated_at: new Date().toISOString(),
          })
          .eq("customer_token", customerToken);
      }
      await supabase.from("points_transactions").insert({
        customer_token: customerToken,
        type: "bonus",
        points: bonusReferee,
        order_id: orderId,
      });
    } else {
      await supabase.from("referrals").update({ status: "invalid" }).eq("id", referral.id);
    }
  }

  const leveledUp = newLevel > previousLevel;

  return { ok: true, pointsEarned: pts, previousLevel, newLevel, leveledUp };
}
