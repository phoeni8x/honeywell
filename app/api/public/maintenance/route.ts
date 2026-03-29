import { getMaintenanceModeViaRest, parseMaintenanceEnabled } from "@/lib/maintenance-mode";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viaRest = await getMaintenanceModeViaRest();
    if (viaRest !== null) {
      return NextResponse.json(
        { maintenance_mode: viaRest },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const supabase = createServiceClient();
    const { data } = await supabase.from("settings").select("value").eq("key", "maintenance_mode");
    const rows = data ?? [];
    const on = rows.some((r) => parseMaintenanceEnabled(r.value));
    const modeRaw = on ? "1" : rows[0]?.value ?? "0";
    return NextResponse.json(
      { maintenance_mode: parseMaintenanceEnabled(modeRaw) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(
      { maintenance_mode: false },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
