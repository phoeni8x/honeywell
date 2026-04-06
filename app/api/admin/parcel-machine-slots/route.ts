import { jsonAdminSupabaseFailure, jsonAdminUnexpectedError } from "@/lib/admin-api-error-response";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const TAG = "parcel-machine-slots";

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
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    let supabase;
    try {
      supabase = createServiceClient();
    } catch (e) {
      return jsonAdminUnexpectedError(`${TAG} GET createServiceClient`, e);
    }

    const includeInactive = request.nextUrl.searchParams.get("all") === "1";
    let q = supabase.from("parcel_machine_slots").select("*").order("sort_order").order("machine_name");
    if (!includeInactive) {
      q = q.eq("is_active", true);
    }
    const { data, error } = await q;
    if (error) {
      return jsonAdminSupabaseFailure(`${TAG} GET`, error);
    }
    return NextResponse.json({ slots: data ?? [] });
  } catch (e) {
    return jsonAdminUnexpectedError(`${TAG} GET`, e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const n = normalizeBody(body);
    if ("error" in n) {
      return NextResponse.json({ error: n.error }, { status: 400 });
    }

    let supabase;
    try {
      supabase = createServiceClient();
    } catch (e) {
      return jsonAdminUnexpectedError(`${TAG} POST createServiceClient`, e);
    }

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
      return jsonAdminSupabaseFailure(`${TAG} POST`, error);
    }

    return NextResponse.json({ slot: data });
  } catch (e) {
    return jsonAdminUnexpectedError(`${TAG} POST`, e);
  }
}
