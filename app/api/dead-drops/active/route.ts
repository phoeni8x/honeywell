import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public: legacy pickup pool availability only (no location details). Parcel lockers use admin-issued details on orders. */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { count, error } = await supabase
      .from("dead_drops")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (error) {
      console.error("[dead-drops/active]", error);
      return NextResponse.json({ available: false, active_count: 0 });
    }
    const activeCount = count ?? 0;
    return NextResponse.json({ available: activeCount > 0, active_count: activeCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ available: false, active_count: 0 });
  }
}
