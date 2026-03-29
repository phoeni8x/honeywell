import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeSettingValue(key: string, raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
  if (key === "maintenance_mode") {
    const low = v.toLowerCase();
    return low === "1" || low === "true" || low === "on" || low === "yes" ? "1" : "0";
  }
  return v;
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown; value?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.trim().toLowerCase() : "";
  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  const value = normalizeSettingValue(key, body?.value);

  const supabase = createServiceClient();

  // Update every row for this key first so legacy duplicate rows cannot keep stale values.
  const updateResult = await supabase.from("settings").update({ value }).eq("key", key).select("key");
  if (updateResult.error) {
    console.error("[admin settings POST:update]", updateResult.error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  if (!updateResult.data || updateResult.data.length === 0) {
    const insertResult = await supabase.from("settings").insert({ key, value });
    if (insertResult.error) {
      console.error("[admin settings POST:insert]", insertResult.error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, key, value });
}
