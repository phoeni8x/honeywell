import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabaseAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const subscription = body.subscription as { endpoint?: string } | undefined;
    if (!subscription?.endpoint || typeof subscription !== "object") {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const svc = createServiceClient();
    const { error } = await svc.from("admin_push_subscription").upsert({
      id: 1,
      subscription,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[admin push subscribe]", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
