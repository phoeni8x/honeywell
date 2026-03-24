import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketId: string }> };

/** All messages for a ticket including internal notes (service role + session check). */
export async function GET(_request: Request, context: Params) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const { ticketId } = await context.params;
  if (!ticketId) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
  }

  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[admin ticket messages GET]", error);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
