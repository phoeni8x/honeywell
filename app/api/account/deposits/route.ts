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
  const format = searchParams.get("format");

  const supabase = createServiceClient();

  if (format === "csv") {
    const { data: rows } = await supabase
      .from("bees_transactions")
      .select("*")
      .eq("customer_token", token)
      .eq("type", "purchase")
      .order("created_at", { ascending: false });

    const lines = [
      ["created_at", "amount_bees", "amount_huf", "payment_method", "reference"].join(","),
      ...((rows ?? []) as Record<string, unknown>[]).map((r) =>
        [
          r.created_at,
          r.amount_bees,
          r.amount_huf,
          r.payment_method,
          `"${String(r.reference ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="deposits.csv"',
      },
    });
  }

  const fromIdx = (page - 1) * perPage;
  const { data: rows, error, count } = await supabase
    .from("bees_transactions")
    .select("*", { count: "exact" })
    .eq("customer_token", token)
    .eq("type", "purchase")
    .order("created_at", { ascending: false })
    .range(fromIdx, fromIdx + perPage - 1);

  if (error) {
    console.error("[account/deposits]", error);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }

  const { data: w } = await supabase.from("bees_wallets").select("balance_bees").eq("customer_token", token).maybeSingle();

  const { data: allPurchases } = await supabase
    .from("bees_transactions")
    .select("amount_bees")
    .eq("customer_token", token)
    .eq("type", "purchase");

  const totalDeposited = (allPurchases ?? []).reduce((a, r) => a + Number((r as { amount_bees: number }).amount_bees), 0);

  return NextResponse.json({
    deposits: rows ?? [],
    page,
    per_page: perPage,
    total: count ?? 0,
    current_balance_bees: Number(w?.balance_bees ?? 0),
    total_deposited_bees: totalDeposited,
  });
}
