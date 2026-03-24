import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: wallet } = await supabase.from("bees_wallets").select("referral_code").eq("customer_token", token).maybeSingle();

  const { data: refs } = await supabase.from("referrals").select("*").eq("referrer_token", token).order("created_at", { ascending: false });

  const rewarded = (refs ?? []).filter((r: { status: string }) => r.status === "rewarded").length;
  const beesEarned = (refs ?? []).reduce(
    (a, r: { status: string; reward_bees?: number }) => a + (r.status === "rewarded" ? Number(r.reward_bees ?? 0) : 0),
    0
  );

  return NextResponse.json({
    referral_code: wallet?.referral_code ?? null,
    total_referrals: refs?.length ?? 0,
    successful_referrals: rewarded,
    bees_earned: beesEarned,
    referrals: refs ?? [],
  });
}
