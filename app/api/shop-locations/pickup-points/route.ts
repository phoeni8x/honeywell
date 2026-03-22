import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Active locations flagged as pickup points */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("shop_locations")
      .select("*")
      .eq("is_active", true)
      .eq("is_pickup_point", true)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ locations: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ locations: [] });
  }
}
