import { getClientIp } from "@/lib/client-ip";
import { ratelimitTelegram } from "@/lib/ratelimit";
import { createServiceClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

/** Avoid DOMPurify in this route — heavy deps can break Vercel serverless cold starts. */
function trimUsername(raw: string, max: number): string {
  return raw.slice(0, max).trim();
}

function normalizeUsername(u: string) {
  return u.trim().replace(/^@/, "").toLowerCase();
}

type TgOk<T> = { ok: true; result: T } | { ok: false; description?: string };

function isParseError(x: TgOk<unknown> | { parseError: true }): x is { parseError: true } {
  return "parseError" in x && (x as { parseError?: boolean }).parseError === true;
}

async function telegramJson<T>(url: string): Promise<TgOk<T> | { parseError: true }> {
  const tgRes = await fetch(url);
  let data: unknown;
  try {
    data = await tgRes.json();
  } catch {
    return { parseError: true };
  }
  return data as TgOk<T>;
}

function memberStatusOk(status: string | undefined): boolean {
  return (
    status === "member" ||
    status === "administrator" ||
    status === "creator" ||
    status === "restricted"
  );
}

/**
 * Resolve Telegram user id: try getChat(@username), then DB (after user tapped Start on the bot).
 * getChat often returns "chat not found" until the user has messaged the bot at least once — Telegram limitation.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { success } = await ratelimitTelegram.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = await request.json();
    const raw = body.telegram_username;
    if (!raw || typeof raw !== "string") {
      return NextResponse.json({ error: "telegram_username required" }, { status: 400 });
    }

    const telegram_username = trimUsername(raw, 64);
    const username = normalizeUsername(telegram_username);
    if (!username || username.length > 64) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    const adminTelegramUserId = process.env.ADMIN_TELEGRAM_USER_ID?.trim();

    if (!botToken || !channelId) {
      return NextResponse.json(
        { verified: false, error: "Telegram is not configured on the server" },
        { status: 503 }
      );
    }

    const getChatUrl = new URL(`https://api.telegram.org/bot${botToken}/getChat`);
    getChatUrl.searchParams.set("chat_id", `@${username}`);

    const chatResRaw = await telegramJson<{ id: number; type?: string }>(getChatUrl.toString());
    if (isParseError(chatResRaw)) {
      return NextResponse.json(
        { verified: false, error: "Telegram returned an unexpected response. Try again." },
        { status: 502 }
      );
    }
    const chatRes = chatResRaw;

    let telegramUserId: number | null = null;

    if (chatRes.ok && chatRes.result?.id != null) {
      const n = Number(chatRes.result.id);
      if (!Number.isNaN(n)) telegramUserId = n;
    }

    if (telegramUserId == null) {
      const supabase = createServiceClient();
      const { data: row } = await supabase
        .from("telegram_verifications")
        .select("telegram_user_id")
        .eq("telegram_username", username)
        .maybeSingle();
      if (row?.telegram_user_id != null) {
        const n = Number(row.telegram_user_id);
        if (!Number.isNaN(n)) telegramUserId = n;
      }

      if (telegramUserId == null) {
        await supabase.from("telegram_verify_tokens").delete().eq("telegram_username", username);

        const token = randomBytes(16).toString("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const { error: insErr } = await supabase.from("telegram_verify_tokens").insert({
          token,
          telegram_username: username,
          expires_at: expiresAt,
        });
        if (insErr) {
          console.error("[verify-telegram] token insert", insErr);
          return NextResponse.json({
            verified: false,
            error:
              "Could not start Telegram link. Run the latest Supabase migration (telegram_verify_tokens) or try again.",
          });
        }

        const botUser = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "Honeyywell_bot";
        const botUrl = `https://t.me/${botUser}?start=hw_${token}`;
        return NextResponse.json({
          verified: false,
          needsOpenBot: true,
          botUrl,
          message:
            "Open Telegram below so the bot can link this username to your account. After you see the confirmation in Telegram, come back here and tap Verify again.",
        });
      }
    }

    const userIdStr = String(telegramUserId);
    if (adminTelegramUserId && userIdStr === adminTelegramUserId) {
      return NextResponse.json({ verified: true });
    }

    const memberUrl = new URL(`https://api.telegram.org/bot${botToken}/getChatMember`);
    memberUrl.searchParams.set("chat_id", channelId);
    memberUrl.searchParams.set("user_id", userIdStr);

    const memberResRaw = await telegramJson<{ status?: string }>(memberUrl.toString());
    if (isParseError(memberResRaw)) {
      return NextResponse.json(
        { verified: false, error: "Telegram returned an unexpected response. Try again." },
        { status: 502 }
      );
    }
    const memberRes = memberResRaw;

    if (!memberRes.ok) {
      return NextResponse.json({
        verified: false,
        error: memberRes.description || "Telegram API error",
      });
    }

    const status = memberRes.result?.status;
    return NextResponse.json({ verified: memberStatusOk(status) });
  } catch (e) {
    console.error("[verify-telegram]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
