import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const token = request.headers.get("x-customer-token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      products (*),
      dead_drops (*),
      shop_locations (*)
    `
    )
    .eq("customer_token", token)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = (rows ?? []).map((o: Record<string, unknown>) => {
    const { products: prod, dead_drops: dd, shop_locations: sl, ...rest } = o;
    return { ...rest, product: prod, dead_drop: dd ?? null, pickup_location: sl ?? null };
  });

  return NextResponse.json({ orders });
}
