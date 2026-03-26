import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CustomerProfile = {
  customer_token: string;
  customer_username: string | null;
  orders: unknown[];
  points_wallet: { balance_points: number; lifetime_points: number } | null;
  bees_wallet: { balance_bees: number } | null;
  points_transactions: Array<{
    id: string;
    type: string;
    points: number;
    delta_points: number;
    order_id: string | null;
    order_number: string | null;
    order_status: string | null;
    order_total_huf: number | null;
    reason_label: string;
    created_at: string;
  }>;
  bees_deposits: unknown[];
  total_points_earned: number;
  total_bees_deposited: number;
};

export async function GET(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawQ = (searchParams.get("q") ?? "").trim().replace(/^@/, "").toLowerCase();
    if (!rawQ || rawQ.length < 2) {
      return NextResponse.json({ profiles: [] });
    }

    const svc = createServiceClient();
    const { data: seedRows } = await svc
      .from("orders")
      .select("customer_token, customer_username, created_at")
      .or(`customer_username.ilike.%${rawQ}%,customer_token.ilike.%${rawQ}%`)
      .order("created_at", { ascending: false })
      .limit(250);

    const byToken = new Map<string, string | null>();
    for (const r of seedRows ?? []) {
      const token = typeof r.customer_token === "string" ? r.customer_token : "";
      if (!token || byToken.has(token)) continue;
      const uname =
        typeof r.customer_username === "string"
          ? r.customer_username.trim().replace(/^@/, "").toLowerCase()
          : null;
      byToken.set(token, uname || null);
      if (byToken.size >= 10) break;
    }

    const tokens = Array.from(byToken.keys());
    const profiles: CustomerProfile[] = [];
    for (const token of tokens) {
      const [
        ordersRes,
        pointsWalletRes,
        beesWalletRes,
        pointsTxRes,
        beesDepositsRes,
      ] = await Promise.all([
        svc
          .from("orders")
          .select("id, order_number, status, total_price, payment_method, fulfillment_type, points_used, points_earned, created_at, products(name)")
          .eq("customer_token", token)
          .order("created_at", { ascending: false })
          .limit(200),
        svc
          .from("points_wallets")
          .select("balance_points, lifetime_points")
          .eq("customer_token", token)
          .maybeSingle(),
        svc.from("bees_wallets").select("balance_bees").eq("customer_token", token).maybeSingle(),
        svc
          .from("points_transactions")
          .select("id, type, points, order_id, created_at")
          .eq("customer_token", token)
          .order("created_at", { ascending: false })
          .limit(200),
        svc
          .from("bees_transactions")
          .select("id, type, amount_bees, amount_huf, payment_method, reference, created_at")
          .eq("customer_token", token)
          .eq("type", "purchase")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const pointsRows = (pointsTxRes.data ?? []) as Array<{ type?: string; points?: number }>;
      const depositsRows = (beesDepositsRes.data ?? []) as Array<{ amount_bees?: number }>;
      const ordersForLookup = (ordersRes.data ?? []) as Array<{
        id?: string | null;
        order_number?: string | null;
        status?: string | null;
        total_price?: number | null;
      }>;
      const orderById = new Map(
        ordersForLookup
          .filter((o) => typeof o.id === "string" && o.id)
          .map((o) => [o.id as string, o])
      );
      const enrichedPointsTransactions = ((pointsTxRes.data ?? []) as Array<{
        id?: string;
        type?: string;
        points?: number;
        order_id?: string | null;
        created_at?: string;
      }>).map((tx) => {
        const type = String(tx.type ?? "");
        const points = Number(tx.points ?? 0);
        const orderId = typeof tx.order_id === "string" ? tx.order_id : null;
        const order = orderId ? orderById.get(orderId) : null;
        const reasonLabel =
          type === "earn"
            ? "Completed order reward"
            : type === "redeem"
              ? "Used points at checkout"
              : type === "expire"
                ? "Points expired"
                : type === "bonus" && orderId
                  ? "Bonus linked to order"
                  : type === "bonus"
                    ? "Bonus points"
                    : "Points adjustment";
        return {
          id: String(tx.id ?? ""),
          type,
          points,
          delta_points: type === "redeem" || type === "expire" ? -Math.abs(points) : Math.abs(points),
          order_id: orderId,
          order_number: (order?.order_number as string | null | undefined) ?? null,
          order_status: (order?.status as string | null | undefined) ?? null,
          order_total_huf:
            typeof order?.total_price === "number" ? Number(order.total_price) : null,
          reason_label: reasonLabel,
          created_at: String(tx.created_at ?? new Date(0).toISOString()),
        };
      });
      profiles.push({
        customer_token: token,
        customer_username: byToken.get(token) ?? null,
        orders: ordersRes.data ?? [],
        points_wallet: pointsWalletRes.data
          ? {
              balance_points: Number(pointsWalletRes.data.balance_points ?? 0),
              lifetime_points: Number(pointsWalletRes.data.lifetime_points ?? 0),
            }
          : null,
        bees_wallet: beesWalletRes.data
          ? { balance_bees: Number(beesWalletRes.data.balance_bees ?? 0) }
          : null,
        points_transactions: enrichedPointsTransactions,
        bees_deposits: beesDepositsRes.data ?? [],
        total_points_earned: pointsRows
          .filter((r) => r.type === "earn")
          .reduce((sum, r) => sum + Number(r.points ?? 0), 0),
        total_bees_deposited: depositsRows.reduce((sum, r) => sum + Number(r.amount_bees ?? 0), 0),
      });
    }

    return NextResponse.json({ profiles });
  } catch (e) {
    console.error("[admin customers search]", e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
