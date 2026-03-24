import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Admin inbox: full ticket list (service role + session check — reliable vs client RLS). */
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("tickets")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[admin tickets GET]", error);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    return NextResponse.json({ tickets: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
