import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  banChatMemberApi,
  getTelegramUserIdByUsername,
  unbanChatMemberApi,
} from "@/lib/telegram";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function resolveUsernameByToken(svc: ReturnType<typeof createServiceClient>, token: string) {
  const { data } = await svc
    .from("orders")
    .select("customer_username, created_at")
    .eq("customer_token", token)
    .not("customer_username", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const username =
    typeof data?.customer_username === "string"
      ? data.customer_username.trim().replace(/^@/, "").toLowerCase()
      : "";
  return username || null;
}

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("customer_moderation")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[moderation GET]", error);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "ban" | "unban" | "kick_channel" | "unkick_channel";
      customer_token?: string;
      reason?: string;
    };
    const action = body.action;
    const token = String(body.customer_token ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    if (!action || !token) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const svc = createServiceClient();
    const now = new Date().toISOString();

    if (action === "ban") {
      const { error } = await svc.from("customer_moderation").upsert(
        {
          customer_token: token,
          is_banned: true,
          ban_reason: reason || null,
          banned_at: now,
          banned_by: admin.email ?? "admin",
          updated_at: now,
        },
        { onConflict: "customer_token" }
      );
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "unban") {
      const { error } = await svc.from("customer_moderation").upsert(
        {
          customer_token: token,
          is_banned: false,
          unbanned_at: now,
          unbanned_by: admin.email ?? "admin",
          updated_at: now,
        },
        { onConflict: "customer_token" }
      );
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const channelId = process.env.TELEGRAM_CHANNEL_ID?.trim();
    if (!botToken || !channelId) {
      return NextResponse.json(
        { error: "Telegram channel controls are not configured on the server." },
        { status: 400 }
      );
    }

    const username = await resolveUsernameByToken(svc, token);
    if (!username) {
      return NextResponse.json(
        { error: "No Telegram username found for this customer yet." },
        { status: 400 }
      );
    }
    const userId = await getTelegramUserIdByUsername(botToken, username);
    if (!userId) {
      return NextResponse.json({ error: "Could not resolve Telegram user id." }, { status: 400 });
    }

    if (action === "kick_channel") {
      const tg = await banChatMemberApi(botToken, channelId, userId);
      if (!tg.ok) {
        return NextResponse.json({ error: tg.description ?? PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
      }
      await svc.from("customer_moderation").upsert(
        {
          customer_token: token,
          channel_kicked: true,
          channel_kicked_at: now,
          updated_at: now,
        },
        { onConflict: "customer_token" }
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "unkick_channel") {
      const tg = await unbanChatMemberApi(botToken, channelId, userId);
      if (!tg.ok) {
        return NextResponse.json({ error: tg.description ?? PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
      }
      await svc.from("customer_moderation").upsert(
        {
          customer_token: token,
          channel_kicked: false,
          channel_unbanned_at: now,
          updated_at: now,
        },
        { onConflict: "customer_token" }
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
  } catch (e) {
    console.error("[moderation POST]", e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
