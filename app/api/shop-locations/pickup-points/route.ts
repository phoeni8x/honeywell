import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Active locations flagged as pickup points */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("shop_locations")
      .select("*")
      .eq("is_active", true)
      .eq("is_pickup_point", true)
      .or(
        `pickup_available_from.is.null,pickup_available_from.lte.${nowIso}`
      )
      .or(
        `pickup_available_until.is.null,pickup_available_until.gte.${nowIso}`
      )
      .order("name", { ascending: true });

    if (error) {
      console.error("[pickup-points]", error);
      return NextResponse.json({ locations: [] });
    }
    return NextResponse.json({ locations: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ locations: [] });
  }
}
