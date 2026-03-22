import { getClientIp } from "@/lib/client-ip";
import { ratelimitTelegram } from "@/lib/ratelimit";
import { sanitizePlainText } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function normalizeUsername(u: string) {
  return u.trim().replace(/^@/, "").toLowerCase();
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { success } = await ratelimitTelegram.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const raw = body.telegram_username;
    if (!raw || typeof raw !== "string") {
      return NextResponse.json({ error: "telegram_username required" }, { status: 400 });
    }

    const telegram_username = sanitizePlainText(raw, 64);
    const username = normalizeUsername(telegram_username);
    if (!username || username.length > 64) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!botToken || !channelId) {
      return NextResponse.json(
        { verified: false, error: "Telegram is not configured on the server" },
        { status: 503 }
      );
    }

    const supabase = createServiceClient();
    const { data: row } = await supabase
      .from("telegram_verifications")
      .select("telegram_user_id")
      .eq("telegram_username", username)
      .maybeSingle();

    if (!row?.telegram_user_id) {
      return NextResponse.json({
        verified: false,
        needsBotVerify: true,
        message: "Please send /verify to our Honey Well Telegram bot first, then try again.",
      });
    }

    const url = new URL(`https://api.telegram.org/bot${botToken}/getChatMember`);
    url.searchParams.set("chat_id", channelId);
    url.searchParams.set("user_id", String(row.telegram_user_id));

    const tgRes = await fetch(url.toString());
    const tgJson = await tgRes.json();

    if (!tgJson.ok) {
      return NextResponse.json({
        verified: false,
        error: tgJson.description || "Telegram API error",
      });
    }

    const status = tgJson.result?.status as string | undefined;
    const ok =
      status === "member" || status === "administrator" || status === "creator";

    return NextResponse.json({ verified: ok });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
