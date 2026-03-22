import { createServiceClient } from "@/lib/supabase/admin";
import { basePointsFromOrderHuf, calculateLevel, pointsWithLevelBonus } from "@/lib/levels";

const MIN_REFERRAL_BEES = 0.05;

/** Run after order is set to `confirmed`. Idempotent per order for points. */
export async function processOrderConfirmed(orderId: string): Promise<{ ok: boolean; newLevel?: number }> {
  const supabase = createServiceClient();

  const { data: existingPt } = await supabase
    .from("points_transactions")
    .select("id")
    .eq("order_id", orderId)
    .eq("type", "earn")
    .maybeSingle();

  if (existingPt) {
    return { ok: true };
  }

  const { data: order, error: oErr } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (oErr || !order || order.status !== "confirmed") {
    return { ok: false };
  }

  const customerToken = order.customer_token as string;
  const totalHuf = Number(order.total_price);

  const { data: wallet } = await supabase
    .from("points_wallets")
    .select("*")
    .eq("customer_token", customerToken)
    .maybeSingle();

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

  return { ok: true, newLevel };
}
