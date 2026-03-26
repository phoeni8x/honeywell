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

    const tickets = data ?? [];
    const orderIds = Array.from(
      new Set(
        tickets
          .map((t) => (typeof t.order_id === "string" ? t.order_id : null))
          .filter((v): v is string => Boolean(v))
      )
    );
    const customerTokens = Array.from(
      new Set(
        tickets
          .map((t) => (typeof t.customer_token === "string" ? t.customer_token : null))
          .filter((v): v is string => Boolean(v))
      )
    );

    const usernameByOrderId = new Map<string, string>();
    const usernameByToken = new Map<string, string>();

    if (orderIds.length > 0) {
      const { data: orderRows } = await svc
        .from("orders")
        .select("id, customer_username")
        .in("id", orderIds);
      for (const row of orderRows ?? []) {
        const id = typeof row.id === "string" ? row.id : "";
        const unameRaw =
          typeof row.customer_username === "string"
            ? row.customer_username.trim().replace(/^@/, "").toLowerCase()
            : "";
        if (id && unameRaw) usernameByOrderId.set(id, unameRaw);
      }
    }

    if (customerTokens.length > 0) {
      const { data: tokenRows } = await svc
        .from("orders")
        .select("customer_token, customer_username, created_at")
        .in("customer_token", customerTokens)
        .not("customer_username", "is", null)
        .order("created_at", { ascending: false });
      for (const row of tokenRows ?? []) {
        const token = typeof row.customer_token === "string" ? row.customer_token : "";
        const unameRaw =
          typeof row.customer_username === "string"
            ? row.customer_username.trim().replace(/^@/, "").toLowerCase()
            : "";
        if (!token || !unameRaw || usernameByToken.has(token)) continue;
        usernameByToken.set(token, unameRaw);
      }
    }

    const enriched = tickets.map((t) => {
      const orderId = typeof t.order_id === "string" ? t.order_id : null;
      const token = typeof t.customer_token === "string" ? t.customer_token : "";
      const customer_username =
        (orderId ? usernameByOrderId.get(orderId) : null) ?? usernameByToken.get(token) ?? null;
      return { ...t, customer_username };
    });

    return NextResponse.json({ tickets: enriched });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: "ticket" | "customer" | "all";
      ticket_id?: string;
      customer_token?: string;
    };
    const mode = body.mode;
    const svc = createServiceClient();

    if (mode === "ticket") {
      const ticketId = String(body.ticket_id ?? "").trim();
      if (!ticketId) return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
      await svc.from("ticket_messages").delete().eq("ticket_id", ticketId);
      await svc.from("tickets").delete().eq("id", ticketId);
      return NextResponse.json({ ok: true });
    }

    if (mode === "customer") {
      const token = String(body.customer_token ?? "").trim();
      if (!token) return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
      const { data: rows } = await svc.from("tickets").select("id").eq("customer_token", token);
      const ids = (rows ?? []).map((r) => String(r.id));
      if (ids.length > 0) {
        await svc.from("ticket_messages").delete().in("ticket_id", ids);
      }
      await svc.from("tickets").delete().eq("customer_token", token);
      return NextResponse.json({ ok: true });
    }

    if (mode === "all") {
      await svc.from("ticket_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await svc.from("tickets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
