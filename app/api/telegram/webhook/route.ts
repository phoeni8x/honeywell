import { createServiceClient } from "@/lib/supabase/admin";
import { getChannelMembership } from "@/lib/telegram";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TgPhotoSize = { file_id: string; file_unique_id: string; width: number; height: number };

type TgMessage = {
  message_id: number;
  from?: { id: number; username?: string };
  chat?: { id: number; type: string };
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
};

type TelegramUpdate = { message?: TgMessage };

const USERNAME_REQUIRED_MESSAGE =
  "Please set a public Telegram username first (Settings → Telegram → Username). Honey Well needs it before we can verify you or link your account — then try again.";

async function sendBotMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isAdminTelegram(userId: number): boolean {
  const a = process.env.ADMIN_TELEGRAM_USER_ID?.trim();
  if (!a) return false;
  return String(userId) === a;
}

/** Broadcast: text /broadcast … or photo whose caption starts with /broadcast */
function isBroadcastIntent(msg: TgMessage): boolean {
  const t = msg.text?.trim() ?? "";
  if (t && /^\/broadcast(?:@\w+)?/i.test(t)) return true;
  const c = msg.caption?.trim() ?? "";
  if (msg.photo?.length && c && /^\/broadcast(?:@\w+)?/i.test(c)) return true;
  return false;
}

function stripBroadcastPrefix(s: string): string {
  return s.replace(/^\/broadcast(?:@\w+)?\s*/i, "").trim();
}

async function handleBroadcast(
  botToken: string,
  adminChatId: number,
  msg: TgMessage,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data: rows, error } = await supabase.from("telegram_verifications").select("telegram_user_id");
  if (error) {
    await sendBotMessage(botToken, adminChatId, "Could not load recipients. Try again.");
    return;
  }

  const adminId = Number(process.env.ADMIN_TELEGRAM_USER_ID);
  const rawIds = (rows ?? [])
    .map((r) => Number(r.telegram_user_id))
    .filter((n) => Number.isFinite(n) && n > 0);
  const ids = Array.from(new Set(rawIds)).filter((id) => id !== adminId);

  if (ids.length === 0) {
    await sendBotMessage(
      botToken,
      adminChatId,
      "No saved customers yet. Users need to message the bot with /start (with a username) so we can store their Telegram ID."
    );
    return;
  }

  const hasPhoto = Boolean(msg.photo?.length);
  const captionRaw = msg.caption?.trim() ?? "";

  if (hasPhoto) {
    if (!/^\/broadcast(?:@\w+)?/i.test(captionRaw)) {
      await sendBotMessage(
        botToken,
        adminChatId,
        "For photos: add a caption that starts with /broadcast (you can add text after it for the announcement)."
      );
      return;
    }
    const outCaption = stripBroadcastPrefix(captionRaw);
    const fileId = msg.photo![msg.photo!.length - 1]!.file_id;
    let ok = 0;
    let fail = 0;
    for (const uid of ids) {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: uid,
          photo: fileId,
          ...(outCaption ? { caption: outCaption } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (j.ok) ok++;
      else fail++;
      await sleep(40);
    }
    await sendBotMessage(
      botToken,
      adminChatId,
      `Photo broadcast: ${ok} delivered${fail ? `, ${fail} failed (blocked bot or deleted chat).` : "."}`
    );
    return;
  }

  const textRaw = msg.text?.trim() ?? "";
  const announcement = stripBroadcastPrefix(textRaw);
  if (!announcement) {
    await sendBotMessage(
      botToken,
      adminChatId,
      "Usage:\n/broadcast Your message here\n\nOr send a photo with a caption starting with /broadcast (optional text after it)."
    );
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const uid of ids) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: uid, text: announcement }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (j.ok) ok++;
    else fail++;
    await sleep(40);
  }
  await sendBotMessage(
    botToken,
    adminChatId,
    `Broadcast sent: ${ok} delivered${fail ? `, ${fail} failed.` : "."}`
  );
}

/** `/start` or `start` (not the website deep link `hw_<token>`). */
function isPlainStartCommand(text: string): boolean {
  const t = text.trim();
  if (/^start$/i.test(t)) return true;
  if (!/^\/start/i.test(t)) return false;
  if (/^\/start\s+hw_[a-f0-9]{32}\s*$/i.test(t)) return false;
  return true;
}

async function sendStartMembershipReply(
  botToken: string,
  channelId: string | undefined,
  chatId: number,
  userId: number,
  linkInstruction?: string
) {
  let body: string;
  if (channelId) {
    const m = await getChannelMembership(botToken, channelId, userId);
    if (m.ok) {
      body = m.member
        ? "You're verified as a Honey Well team member."
        : "Welcome, guest.";
    } else {
      body = `Could not verify channel membership. ${m.error}`;
    }
  } else {
    body = "Welcome to Honey Well.";
  }
  if (linkInstruction) {
    body = `${body}\n\n${linkInstruction}`;
  }
  await sendBotMessage(botToken, chatId, body);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = request.headers.get("x-telegram-bot-api-secret-token");

  if (process.env.NODE_ENV === "production") {
    if (!webhookSecret || header !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (webhookSecret && header !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const msg = update.message;
  if (!msg || msg.chat?.type !== "private") {
    return NextResponse.json({ ok: true });
  }

  const from = msg.from;
  if (!from?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = msg.chat.id;
  const text = msg.text?.trim() ?? "";

  const supabase = createServiceClient();

  if (isAdminTelegram(from.id) && isBroadcastIntent(msg)) {
    await handleBroadcast(botToken, chatId, msg, supabase);
    return NextResponse.json({ ok: true });
  }

  const hasUsername = Boolean(from.username?.trim());
  if (!hasUsername) {
    await sendBotMessage(botToken, chatId, USERNAME_REQUIRED_MESSAGE);
    return NextResponse.json({ ok: true });
  }

  const startMatch = /^\/start\s+hw_([a-f0-9]{32})$/i.exec(text);
  if (startMatch) {
    const token = startMatch[1];

    const tgUser = from.username!.trim().replace(/^@/, "").toLowerCase();

    const { data: row, error: fetchErr } = await supabase
      .from("telegram_verify_tokens")
      .select("telegram_username, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (fetchErr || !row) {
      await sendBotMessage(
        botToken,
        chatId,
        "This link is invalid or expired. Go back to the Honey Well site, enter your username, and tap Verify again."
      );
      return NextResponse.json({ ok: true });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabase.from("telegram_verify_tokens").delete().eq("token", token);
      await sendBotMessage(
        botToken,
        chatId,
        "This link expired. Go back to the site and tap Verify again to get a new link."
      );
      return NextResponse.json({ ok: true });
    }

    const expected = row.telegram_username.trim().toLowerCase();
    if (tgUser !== expected) {
      await sendBotMessage(
        botToken,
        chatId,
        `This link is for @${expected}. You’re logged into Telegram as @${tgUser}. Use the account that matches what you typed on the website.`
      );
      return NextResponse.json({ ok: true });
    }

    await supabase.from("telegram_verifications").upsert(
      {
        telegram_username: tgUser,
        telegram_user_id: from.id,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "telegram_username" }
    );
    await supabase.from("telegram_verify_tokens").delete().eq("token", token);

    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    await sendStartMembershipReply(
      botToken,
      channelId,
      chatId,
      from.id,
      "Return to the Honey Well website and tap Verify again to finish."
    );
    return NextResponse.json({ ok: true });
  }

  if (isPlainStartCommand(text)) {
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    await sendStartMembershipReply(botToken, channelId, chatId, from.id);
    const username = from.username!.trim().replace(/^@/, "").toLowerCase();
    await supabase.from("telegram_verifications").upsert(
      {
        telegram_username: username,
        telegram_user_id: from.id,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "telegram_username" }
    );
    return NextResponse.json({ ok: true });
  }

  const username = from.username!.trim().replace(/^@/, "").toLowerCase();
  await supabase.from("telegram_verifications").upsert(
    {
      telegram_username: username,
      telegram_user_id: from.id,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "telegram_username" }
  );

  return NextResponse.json({ ok: true });
}
