import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public read for delivery tracking */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("admin_location").select("*").eq("id", 1).maybeSingle();
    if (error) {
      return NextResponse.json({ location: null }, { status: 200 });
    }
    return NextResponse.json({ location: data });
  } catch {
    return NextResponse.json({ location: null });
  }
}
