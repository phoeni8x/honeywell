import { getClientIp } from "@/lib/client-ip";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { ratelimitRedeemPoints } from "@/lib/ratelimit";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const MIN_REDEEM = 500;

/** POST { customer_token, points } — deduct points (1 pt = 1 HUF discount per Part 2) */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { success } = await ratelimitRedeemPoints.limit(ip);
  if (!success) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 429 });
  }

  try {
    const { customer_token, points } = await request.json();
    if (!customer_token || typeof points !== "number") {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    if (points < MIN_REDEEM) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: w } = await supabase
      .from("points_wallets")
      .select("balance_points")
      .eq("customer_token", customer_token)
      .maybeSingle();

    const balance = w?.balance_points ?? 0;
    if (balance < points) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { error } = await supabase
      .from("points_wallets")
      .update({
        balance_points: balance - points,
        updated_at: new Date().toISOString(),
      })
      .eq("customer_token", customer_token);

    if (error) {
      console.error("[redeem-points]", error);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    await supabase.from("points_transactions").insert({
      customer_token,
      type: "redeem",
      points,
    });

    return NextResponse.json({ ok: true, redeemed_points: points, discount_huf: points });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
