import { createServiceClient } from "@/lib/supabase/admin";
import { basePointsFromOrderHuf, calculateLevel } from "@/lib/levels";

const MIN_REFERRAL_BEES = 0.05;

export type ProcessOrderConfirmedResult = {
  ok: boolean;
  /** Points earned for this order (earn transaction). */
  pointsEarned?: number;
  previousLevel?: number;
  newLevel?: number;
  leveledUp?: boolean;
};

/** Run after order completion (`delivered`/`picked_up`). Idempotent per order for points. */
export async function processOrderConfirmed(orderId: string): Promise<ProcessOrderConfirmedResult> {
  const supabase = createServiceClient();
  const { data: order, error: oErr } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (oErr || !order) {
    return { ok: false };
  }
  // Rewards are awarded only for completed orders.
  if (order.status !== "delivered" && order.status !== "picked_up") {
    return { ok: true, pointsEarned: 0, previousLevel: 1, newLevel: 1, leveledUp: false };
  }

  // Idempotency guard: claim this order once at DB level.
  const { data: claimedOrder, error: claimErr } = await supabase
    .from("orders")
    .update({ rewards_processed_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("rewards_processed_at", null)
    .in("status", ["delivered", "picked_up"])
    .select("*")
    .maybeSingle();

  if (claimErr) {
    return { ok: false };
  }

  if (!claimedOrder) {
    const { data: w } = await supabase
      .from("points_wallets")
      .select("buyer_level")
      .eq("customer_token", order.customer_token as string)
      .maybeSingle();
    const lv = w?.buyer_level ?? 1;
    return { ok: true, pointsEarned: Number(order.points_earned ?? 0), previousLevel: lv, newLevel: lv, leveledUp: false };
  }

  const customerToken = claimedOrder.customer_token as string;
  const totalHuf = Number(claimedOrder.total_price);
  const pointsUsed = Number(claimedOrder.points_used ?? 0);

  // Backfill guard for legacy rows that may already have an earn tx from earlier flows.
  const { data: existingEarnTx } = await supabase
    .from("points_transactions")
    .select("points")
    .eq("customer_token", customerToken)
    .eq("order_id", orderId)
    .eq("type", "earn")
    .maybeSingle();

  if (existingEarnTx) {
    const earned = Number(existingEarnTx.points ?? 0);
    await supabase.from("orders").update({ points_earned: earned }).eq("id", orderId);
    const { data: w } = await supabase
      .from("points_wallets")
      .select("buyer_level")
      .eq("customer_token", customerToken)
      .maybeSingle();
    const lv = w?.buyer_level ?? 1;
    return { ok: true, pointsEarned: earned, previousLevel: lv, newLevel: lv, leveledUp: false };
  }

  const { data: wallet } = await supabase
    .from("points_wallets")
    .select("*")
    .eq("customer_token", customerToken)
    .maybeSingle();

  const previousLevel = wallet?.buyer_level ?? 1;

  const totalOrders = (wallet?.total_orders ?? 0) + 1;
  const totalSpent = Number(wallet?.total_spent_huf ?? 0) + totalHuf;
  const newLevel = calculateLevel(totalOrders, totalSpent);

  // Earning rules:
  // - minimum completed order value: 50,000 HUF
  // - no points earned when points were used on this order
  const eligibleForEarn = totalHuf >= 50_000 && pointsUsed <= 0;
  const pts = eligibleForEarn ? basePointsFromOrderHuf(totalHuf) : 0;

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

  if (pts > 0) {
    await supabase.from("points_transactions").insert({
      customer_token: customerToken,
      type: "earn",
      points: pts,
      order_id: orderId,
    });
  }

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
