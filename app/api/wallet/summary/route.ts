import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const token = request.headers.get("x-customer-token");
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const [bees, points] = await Promise.all([
      supabase
        .from("bees_wallets")
        .select("balance_bees, referral_code")
        .eq("customer_token", token)
        .maybeSingle(),
      supabase
        .from("points_wallets")
        .select("balance_points, lifetime_points, buyer_level, total_orders, total_spent_huf")
        .eq("customer_token", token)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      bees: Number(bees.data?.balance_bees ?? 0),
      points: points.data?.balance_points ?? 0,
      lifetime_points: points.data?.lifetime_points ?? 0,
      buyer_level: points.data?.buyer_level ?? 1,
      total_orders: points.data?.total_orders ?? 0,
      total_spent_huf: Number(points.data?.total_spent_huf ?? 0),
      referral_code: bees.data?.referral_code ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ bees: 0, points: 0, lifetime_points: 0 });
  }
}
