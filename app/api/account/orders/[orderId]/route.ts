import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, context: Params) {
  const token = request.headers.get("x-customer-token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const { orderId } = await context.params;
  const supabase = createServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, products(*)")
    .eq("id", orderId)
    .eq("customer_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { products: prod, ...rest } = order as Record<string, unknown>;
  return NextResponse.json({ order: { ...rest, product: prod } });
}
