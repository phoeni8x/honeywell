import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  banChatMemberApi,
  getChannelMembership,
  getTelegramUserIdByUsername,
  unbanChatMemberApi,
} from "@/lib/telegram";
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

const FIRST_CONTACT_COMMUNITY_MESSAGE =
  "Welcome to Honey Well. Sending /start, tapping Start, or sending /verify registers you with our community — we save your Telegram so we can verify VIP access and send updates from Honey Well.";

const ADMIN_RULES_TEXT = `Honey Well — Admin commands (your Telegram user id must match ADMIN_TELEGRAM_USER_ID)

Note: "Continue as Guest" on the website only saves Guest in this browser — those people are not in the database. This bot saves people who message it (with a username) to Supabase, with team channel vs guest (not in channel) when TELEGRAM_CHANNEL_ID is set.

/rules — This list.

/broadcast — Mass message to everyone who opted in:
• Text: /broadcast then your message (same line or multiple lines after a space).
• Photo: send an image with a caption starting with /broadcast (optional text after it).

/broadcast_list — See who can receive broadcasts (opted in vs out) from saved customers.

/kick <user id or @username> — Remove that user from the team channel (ban). The bot must be an admin in the channel. Example: /kick 123456789 or /kick @name

/unban <user id or @username> — Lift the ban so they can rejoin with the channel invite link.

———
Customers (not admin-only) in this chat:
/broadcast_off — Stop receiving broadcast announcements.
/broadcast_on — Receive broadcasts again (default).`;

async function sendBotMessage(botToken: string, chatId: number, text: string) {
  const max = 4096;
  for (let i = 0; i < text.length; i += max) {
    const chunk = text.slice(i, i + max);
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isAdminTelegram(userId: number): boolean {
  const a = process.env.ADMIN_TELEGRAM_USER_ID?.trim();
  if (!a) return false;
  return String(userId) === a;
}

/**
 * Mass broadcast only — not /broadcast_list or /broadcast_off /broadcast_on.
 */
function isMassBroadcastIntent(msg: TgMessage): boolean {
  const t = msg.text?.trim() ?? "";
  if (t) {
    if (/^\/broadcast_list$/i.test(t)) return false;
    if (/^\/broadcast_(on|off)$/i.test(t)) return false;
    if (/^\/broadcast(?:@\w+)?(?:\s|$)/i.test(t)) return true;
  }
  const c = msg.caption?.trim() ?? "";
  if (msg.photo?.length && c && /^\/broadcast(?:@\w+)?/i.test(c)) return true;
  return false;
}

function stripBroadcastPrefix(s: string): string {
  return s.replace(/^\/broadcast(?:@\w+)?\s*/i, "").trim();
}

async function resolveTargetUserId(
  botToken: string,
  supabase: ReturnType<typeof createServiceClient>,
  raw: string
): Promise<{ id: number } | { error: string }> {
  const r = raw.trim();
  if (/^\d+$/.test(r)) {
    const n = Number(r);
    if (Number.isFinite(n) && n > 0) return { id: n };
  }
  const uname = r.replace(/^@/, "").toLowerCase();
  if (!uname) return { error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST };
  const { data } = await supabase
    .from("telegram_verifications")
    .select("telegram_user_id")
    .eq("telegram_username", uname)
    .maybeSingle();
  if (data?.telegram_user_id != null) return { id: Number(data.telegram_user_id) };
  const tgId = await getTelegramUserIdByUsername(botToken, uname);
  if (tgId != null) return { id: tgId };
  return { error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST };
}

async function handleBroadcast(
  botToken: string,
  adminChatId: number,
  msg: TgMessage,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data: rows, error } = await supabase
    .from("telegram_verifications")
    .select("telegram_user_id")
    .eq("broadcast_opt_in", true);

  if (error) {
    await sendBotMessage(botToken, adminChatId, PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
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
      "No recipients opted in. Users must use /start (with a username) and not use /broadcast_off."
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

async function handleBroadcastList(
  botToken: string,
  adminChatId: number,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data: rows, error } = await supabase
    .from("telegram_verifications")
    .select("telegram_username, telegram_user_id, broadcast_opt_in, is_channel_member")
    .order("telegram_username");

  if (error) {
    await sendBotMessage(botToken, adminChatId, PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    return;
  }

  const list = rows ?? [];
  let inC = 0;
  let outC = 0;
  const lines: string[] = ["Broadcast preferences (Telegram bot contacts only — not website-only guests):\n"];
  for (const r of list.slice(0, 80)) {
    const on = r.broadcast_opt_in !== false;
    if (on) inC++;
    else outC++;
    const mem = r.is_channel_member;
    const role =
      mem === true ? "team channel" : mem === false ? "Telegram guest (not in channel)" : "channel status unknown";
    lines.push(
      `@${r.telegram_username} — ${on ? "broadcasts on" : "broadcasts off"} · ${role} · id ${r.telegram_user_id}`
    );
  }
  if (list.length > 80) lines.push(`\n… and ${list.length - 80} more (trimmed for message size).`);
  lines.push(`\nTotal: ${list.length} — ${inC} opted in, ${outC} opted out.`);
  await sendBotMessage(botToken, adminChatId, lines.join("\n"));
}

async function handleAdminKick(
  botToken: string,
  adminChatId: number,
  channelId: string | undefined,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!channelId) {
    await sendBotMessage(botToken, adminChatId, "TELEGRAM_CHANNEL_ID is not set on the server.");
    return;
  }
  const m = /^\/kick\s+(.+)$/i.exec(text.trim());
  const raw = m?.[1]?.trim() ?? "";
  if (!raw) {
    await sendBotMessage(botToken, adminChatId, "Usage: /kick <user id or @username>");
    return;
  }
  const resolved = await resolveTargetUserId(botToken, supabase, raw);
  if ("error" in resolved) {
    await sendBotMessage(botToken, adminChatId, resolved.error);
    return;
  }
  const r = await banChatMemberApi(botToken, channelId, resolved.id);
  if (r.ok) {
    await sendBotMessage(botToken, adminChatId, `Removed user ${resolved.id} from the channel (ban). They can be allowed back with /unban.`);
  } else {
    await sendBotMessage(botToken, adminChatId, `Telegram: ${r.description ?? "ban failed"}`);
  }
}

async function handleAdminUnban(
  botToken: string,
  adminChatId: number,
  channelId: string | undefined,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!channelId) {
    await sendBotMessage(botToken, adminChatId, "TELEGRAM_CHANNEL_ID is not set on the server.");
    return;
  }
  const m = /^\/unban\s+(.+)$/i.exec(text.trim());
  const raw = m?.[1]?.trim() ?? "";
  if (!raw) {
    await sendBotMessage(botToken, adminChatId, "Usage: /unban <user id or @username>");
    return;
  }
  const resolved = await resolveTargetUserId(botToken, supabase, raw);
  if ("error" in resolved) {
    await sendBotMessage(botToken, adminChatId, resolved.error);
    return;
  }
  const r = await unbanChatMemberApi(botToken, channelId, resolved.id);
  if (r.ok) {
    await sendBotMessage(
      botToken,
      adminChatId,
      `Unbanned user ${resolved.id}. They can rejoin the channel using the invite link.`
    );
  } else {
    await sendBotMessage(botToken, adminChatId, `Telegram: ${r.description ?? "unban failed"}`);
  }
}

function isPlainStartCommand(text: string): boolean {
  const t = text.trim();
  if (/^start$/i.test(t) || /^verify$/i.test(t)) return true;
  if (/^\/verify(?:\s|$)/i.test(t)) return true;
  if (!/^\/start/i.test(t)) return false;
  if (/^\/start\s+hw_[a-f0-9]{32}\s*$/i.test(t)) return false;
  return true;
}

/** null = channel not configured or Telegram API error (not stored as true/false). */
async function sendStartMembershipReply(
  botToken: string,
  channelId: string | undefined,
  chatId: number,
  userId: number,
  linkInstruction?: string
): Promise<{ channelMember: boolean | null }> {
  let channelMember: boolean | null = null;
  let body: string;
  if (channelId) {
    const m = await getChannelMembership(botToken, channelId, userId);
    if (m.ok) {
      channelMember = m.member;
      body = m.member
        ? "You're verified as a Honey Well VIP."
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
  return { channelMember };
}

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = request.headers.get("x-telegram-bot-api-secret-token");

  if (process.env.NODE_ENV === "production") {
    if (!webhookSecret || header !== webhookSecret) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }
  } else if (webhookSecret && header !== webhookSecret) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 503 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
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
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  const supabase = createServiceClient();

  if (isAdminTelegram(from.id)) {
    const t = text.trim();
    if (/^\/rules$/i.test(t)) {
      await sendBotMessage(botToken, chatId, ADMIN_RULES_TEXT);
      return NextResponse.json({ ok: true });
    }
    if (/^\/broadcast_list$/i.test(t)) {
      await handleBroadcastList(botToken, chatId, supabase);
      return NextResponse.json({ ok: true });
    }
    if (/^\/kick\s+/i.test(t)) {
      await handleAdminKick(botToken, chatId, channelId, t, supabase);
      return NextResponse.json({ ok: true });
    }
    if (/^\/unban\s+/i.test(t)) {
      await handleAdminUnban(botToken, chatId, channelId, t, supabase);
      return NextResponse.json({ ok: true });
    }
    if (isMassBroadcastIntent(msg)) {
      await handleBroadcast(botToken, chatId, msg, supabase);
      return NextResponse.json({ ok: true });
    }
  }

  const hasUsername = Boolean(from.username?.trim());
  if (!hasUsername) {
    await sendBotMessage(botToken, chatId, USERNAME_REQUIRED_MESSAGE);
    return NextResponse.json({ ok: true });
  }

  const tUser = text.trim();
  if (
    isMassBroadcastIntent(msg) ||
    /^\/broadcast_list$/i.test(tUser) ||
    /^\/rules$/i.test(tUser) ||
    /^\/kick\s/i.test(tUser) ||
    /^\/unban\s/i.test(tUser)
  ) {
    await sendBotMessage(botToken, chatId, "That command is for Honey Well admins only.");
    return NextResponse.json({ ok: true });
  }

  if (/^\/broadcast_off$/i.test(tUser)) {
    const { data, error } = await supabase
      .from("telegram_verifications")
      .update({ broadcast_opt_in: false })
      .eq("telegram_user_id", from.id)
      .select("telegram_user_id");
    if (error || !data?.length) {
      await sendBotMessage(botToken, chatId, "You’re not registered yet. Send /start first.");
    } else {
      await sendBotMessage(
        botToken,
        chatId,
        "You won’t receive broadcast announcements. Use /broadcast_on to turn them back on."
      );
    }
    return NextResponse.json({ ok: true });
  }
  if (/^\/broadcast_on$/i.test(tUser)) {
    const { data, error } = await supabase
      .from("telegram_verifications")
      .update({ broadcast_opt_in: true })
      .eq("telegram_user_id", from.id)
      .select("telegram_user_id");
    if (error || !data?.length) {
      await sendBotMessage(botToken, chatId, "You’re not registered yet. Send /start first.");
    } else {
      await sendBotMessage(botToken, chatId, "You’ll receive broadcast announcements from Honey Well again.");
    }
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

    const { channelMember } = await sendStartMembershipReply(
      botToken,
      channelId,
      chatId,
      from.id,
      "Return to the Honey Well website and tap Verify again to finish."
    );
    await supabase.from("telegram_verifications").upsert(
      {
        telegram_username: tgUser,
        telegram_user_id: from.id,
        verified_at: new Date().toISOString(),
        broadcast_opt_in: true,
        is_channel_member: channelMember,
      },
      { onConflict: "telegram_username" }
    );
    await supabase.from("telegram_verify_tokens").delete().eq("token", token);
    return NextResponse.json({ ok: true });
  }

  if (isPlainStartCommand(text)) {
    const { data: priorRow } = await supabase
      .from("telegram_verifications")
      .select("telegram_user_id")
      .eq("telegram_user_id", from.id)
      .maybeSingle();
    if (!priorRow) {
      await sendBotMessage(botToken, chatId, FIRST_CONTACT_COMMUNITY_MESSAGE);
    }
    const { channelMember } = await sendStartMembershipReply(botToken, channelId, chatId, from.id);
    const username = from.username!.trim().replace(/^@/, "").toLowerCase();
    await supabase.from("telegram_verifications").upsert(
      {
        telegram_username: username,
        telegram_user_id: from.id,
        verified_at: new Date().toISOString(),
        broadcast_opt_in: true,
        is_channel_member: channelMember,
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
