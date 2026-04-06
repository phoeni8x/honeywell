import { requireAdmin } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MAX = 2000;

function normalizePatch(raw: Record<string, unknown> | null): {
  machine_name?: string;
  slot_label?: string;
  location_text?: string;
  sort_order?: number;
  is_active?: boolean;
} | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Invalid body" };
  const out: {
    machine_name?: string;
    slot_label?: string;
    location_text?: string;
    sort_order?: number;
    is_active?: boolean;
  } = {};
  if ("machine_name" in raw) {
    const v = String(raw.machine_name ?? "").trim();
    if (!v || v.length > 200) return { error: "Machine name invalid." };
    out.machine_name = v;
  }
  if ("slot_label" in raw) {
    const v = String(raw.slot_label ?? "").trim();
    if (!v || v.length > 200) return { error: "Slot label invalid." };
    out.slot_label = v;
  }
  if ("location_text" in raw) {
    const v = String(raw.location_text ?? "").trim();
    if (!v || v.length > MAX) return { error: "Location text invalid." };
    out.location_text = v;
  }
  if ("sort_order" in raw) {
    out.sort_order = Math.max(0, Math.min(99999, Math.floor(Number(raw.sort_order) || 0)));
  }
  if ("is_active" in raw) {
    out.is_active = Boolean(raw.is_active);
  }
  if (Object.keys(out).length === 0) return { error: "No fields to update." };
  return out;
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const n = normalizePatch(body);
  if ("error" in n) {
    return NextResponse.json({ error: n.error }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("parcel_machine_slots").update(n).eq("id", id).select("*").maybeSingle();

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Duplicate machine name + slot label." }, { status: 409 });
    }
    console.error("[parcel-machine-slots PATCH]", error);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ slot: data });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("parcel_machine_slots").delete().eq("id", id);
  if (error) {
    console.error("[parcel-machine-slots DELETE]", error);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
