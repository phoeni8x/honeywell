import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseEnabled(v: string | null | undefined): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("settings").select("value").eq("key", "maintenance_mode");
    const rows = data ?? [];
    const on = rows.some((r) => parseEnabled(r.value));
    const modeRaw = on ? "1" : rows[0]?.value ?? "0";
    return NextResponse.json(
      { maintenance_mode: parseEnabled(modeRaw) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(
      { maintenance_mode: false },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
