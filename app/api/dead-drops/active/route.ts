import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public: current active dead drop for checkout */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("dead_drops")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ dead_drop: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ dead_drop: null });
  }
}
