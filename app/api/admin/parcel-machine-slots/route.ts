import { requireAdmin } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MAX = 2000;

function normalizeBody(raw: Record<string, unknown> | null): {
  machine_name: string;
  slot_label: string;
  location_text: string;
  sort_order: number;
  is_active: boolean;
} | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Invalid body" };
  const machine_name = String(raw.machine_name ?? "").trim();
  const slot_label = String(raw.slot_label ?? "").trim();
  const location_text = String(raw.location_text ?? "").trim();
  if (!machine_name || machine_name.length > 200) return { error: "Machine name is required (max 200 chars)." };
  if (!slot_label || slot_label.length > 200) return { error: "Slot label is required (max 200 chars)." };
  if (!location_text || location_text.length > MAX) return { error: "Location text is required (max 2000 chars)." };
  const sort_order = Math.max(0, Math.min(99999, Math.floor(Number(raw.sort_order ?? 0) || 0)));
  const is_active = raw.is_active !== false;
  return { machine_name, slot_label, location_text, sort_order, is_active };
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const includeInactive = request.nextUrl.searchParams.get("all") === "1";
  const supabase = createServiceClient();
  let q = supabase.from("parcel_machine_slots").select("*").order("sort_order").order("machine_name");
  if (!includeInactive) {
    q = q.eq("is_active", true);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[parcel-machine-slots GET]", error);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const n = normalizeBody(body);
  if ("error" in n) {
    return NextResponse.json({ error: n.error }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("parcel_machine_slots")
    .insert({
      machine_name: n.machine_name,
      slot_label: n.slot_label,
      location_text: n.location_text,
      sort_order: n.sort_order,
      is_active: n.is_active,
    })
    .select("*")
    .single();

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "A slot with this machine name and slot label already exists." },
        { status: 409 }
      );
    }
    console.error("[parcel-machine-slots POST]", error);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }

  return NextResponse.json({ slot: data });
}
