import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown; value?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  const value =
    typeof body?.value === "string"
      ? body.value
      : body?.value == null
      ? ""
      : String(body.value);

  const supabase = createServiceClient();

  // Update all rows for this key first so legacy duplicate rows (if any) cannot
  // keep returning stale values from other API reads.
  const updateResult = await supabase.from("settings").update({ value }).eq("key", key).select("key");
  if (updateResult.error) {
    console.error("[admin settings POST:update]", updateResult.error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  // Insert only when the key does not exist yet.
  if (!updateResult.data || updateResult.data.length === 0) {
    const insertResult = await supabase.from("settings").insert({ key, value });
    if (insertResult.error) {
      console.error("[admin settings POST:insert]", insertResult.error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
