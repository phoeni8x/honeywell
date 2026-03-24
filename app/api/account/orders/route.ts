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

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = 10;
  const status = searchParams.get("status");
  const sort = searchParams.get("sort") || "newest";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = createServiceClient();
  let q = supabase
    .from("orders")
    .select("*, products(*)", { count: "exact" })
    .eq("customer_token", token);

  if (status && status !== "all") {
    q = q.eq("status", status);
  }
  if (from) {
    q = q.gte("created_at", new Date(from).toISOString());
  }
  if (to) {
    q = q.lte("created_at", new Date(to).toISOString());
  }

  q = sort === "oldest" ? q.order("created_at", { ascending: true }) : q.order("created_at", { ascending: false });

  const fromIdx = (page - 1) * perPage;
  const { data: rows, error, count } = await q.range(fromIdx, fromIdx + perPage - 1);

  if (error) {
    console.error("[account/orders]", error);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }

  const orders = (rows ?? []).map((row: Record<string, unknown>) => {
    const { products: prod, ...rest } = row;
    return { ...rest, product: prod };
  });

  const { data: sumRows } = await supabase.from("orders").select("total_price").eq("customer_token", token);
  const totalSpent = (sumRows ?? []).reduce((a, r) => a + Number((r as { total_price: number }).total_price), 0);

  return NextResponse.json({
    orders,
    page,
    per_page: perPage,
    total: count ?? 0,
    total_spent_huf: totalSpent,
  });
}
