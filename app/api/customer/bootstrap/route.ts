import {
  generateReferralCode,
  generateReferralCodeFallback,
  isPgUniqueViolation,
} from "@/lib/referral-code";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Ensures bees_wallets + points_wallets rows and a unique referral_code */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = body.customer_token as string | undefined;
    const customer_token = typeof raw === "string" ? raw.trim() : "";
    if (!customer_token) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const supabase = createServiceClient();

    let { data: bees } = await supabase.from("bees_wallets").select("*").eq("customer_token", customer_token).maybeSingle();

    if (!bees) {
      await supabase.from("bees_wallets").insert({ customer_token, balance_bees: 0 });
      const res = await supabase.from("bees_wallets").select("*").eq("customer_token", customer_token).single();
      bees = res.data;
    }

    if (bees && !bees.referral_code) {
      const maxAttempts = 40;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = attempt < maxAttempts - 3 ? generateReferralCode() : generateReferralCodeFallback();
        const { error } = await supabase.from("bees_wallets").update({ referral_code: code }).eq("id", bees.id);
        if (!error) {
          bees = { ...bees, referral_code: code };
          break;
        }
        if (isPgUniqueViolation(error)) {
          continue;
        }
        console.error("[bootstrap] referral_code update (non-unique error)", error);
        break;
      }
    }

    const { data: pts } = await supabase.from("points_wallets").select("*").eq("customer_token", customer_token).maybeSingle();
    if (!pts) {
      await supabase.from("points_wallets").insert({
        customer_token,
        balance_points: 0,
        lifetime_points: 0,
        buyer_level: 1,
        total_orders: 0,
        total_spent_huf: 0,
      });
    }

    const { data: wallet } = await supabase.from("points_wallets").select("*").eq("customer_token", customer_token).single();

    return NextResponse.json({
      referral_code: bees?.referral_code ?? null,
      buyer_level: wallet?.buyer_level ?? 1,
      balance_points: wallet?.balance_points ?? 0,
      balance_bees: Number(bees?.balance_bees ?? 0),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
