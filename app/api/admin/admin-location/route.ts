import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const latitude = body.latitude as number | undefined;
    const longitude = body.longitude as number | undefined;
    const is_sharing = Boolean(body.is_sharing);

    const svc = createServiceClient();
    const { error } = await svc.from("admin_location").upsert({
      id: 1,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      updated_at: new Date().toISOString(),
      is_sharing,
    });

    if (error) {
      console.error("[admin-location POST]", error);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("admin_location").select("*").eq("id", 1).maybeSingle();
    if (error) {
      console.error("[admin-location GET]", error);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }
    return NextResponse.json({ location: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ location: null });
  }
}
