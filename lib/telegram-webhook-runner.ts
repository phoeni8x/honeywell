import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { executeAdminApproveOrder } from "@/lib/admin-approve-order";
import { notifyCustomerPush } from "@/lib/push-notify";
import { sanitizePlainText } from "@/lib/sanitize";
import {
  getTelegramAdminBotToken,
  getTelegramAdminWebhookSecret,
  getTelegramCustomerBotToken,
  getTelegramCustomerWebhookSecret,
} from "@/lib/telegram-bot-tokens";
import {
  banChatMemberApi,
  getChannelMembership,
  getTelegramUserIdByUsername,
  unbanChatMemberApi,
} from "@/lib/telegram";
import { NextResponse } from "next/server";

export type TelegramWebhookRole = "admin" | "customer";

type TgPhotoSize = { file_id: string; file_unique_id: string; width: number; height: number };

type TgMessage = {
  message_id: number;
  from?: { id: number; username?: string };
  chat?: { id: number; type: string };
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  video?: { file_id: string };
};

type TelegramCallbackQuery = {
  id: string;
  from?: { id: number; username?: string };
  data?: string;
  message?: { chat?: { id: number; type?: string } };
};

type TelegramUpdate = { message?: TgMessage; callback_query?: TelegramCallbackQuery };

const USERNAME_REQUIRED_MESSAGE =
  "Please set a public Telegram username first (Settings → Telegram → Username). Honey Well needs it before we can verify you or link your account — then try again.";

const FIRST_CONTACT_COMMUNITY_MESSAGE =
  "Welcome to Honey Well. Sending /start, tapping Start, or sending /verify registers you with our community — we save your Telegram so we can verify VIP access and send updates from Honey Well.";

const LISTS_COMMANDS_TEXT = `Honey Well — command list (admin)

1) Kick someone from your Telegram channel
   /kick or /kickout <user id or @username>

2) Bring them back (lift ban — they rejoin with the channel invite link)
   /unban or /bringin <user id or @username>

3) Broadcast to everyone who used /start and stayed opted in
   Text: /broadcast your message here
   Photo: image with a caption starting with /broadcast
   Video: video with a caption starting with /broadcast

4) Stop a specific customer receiving your broadcasts
   /broadcast_block <user id or @username>

5) Let them receive broadcasts again
   /broadcast_allow <user id or @username>

More: /broadcast_list — who is opted in vs out
      /rules — full admin + customer help text`;

const ADMIN_RULES_TEXT = `Honey Well — Admin commands (your Telegram user id must match ADMIN_TELEGRAM_USER_ID)

Note: "Continue as Guest" on the website only saves Guest in this browser — those people are not in the database. This bot saves people who message it (with a username) to Supabase, with team channel vs guest (not in channel) when TELEGRAM_CHANNEL_ID is set.

/lists or /list — Numbered menu of admin commands (kick/kickout, unban/bringin, broadcast, block/allow per user).
/rules — This full text.

/broadcast — Mass message to everyone who opted in:
• Text: /broadcast then your message (same line or multiple lines after a space).
• Photo: image with a caption starting with /broadcast (optional text after it).
• Video: video with a caption starting with /broadcast (optional text after it).

/broadcast_list — See who can receive broadcasts (opted in vs out) from saved customers.

/kick or /kickout <user id or @username> — Remove that user from the team channel (ban). The bot must be an admin in the channel.

/unban or /bringin <user id or @username> — Lift the ban so they can rejoin with the channel invite link.

/broadcast_block <user id or @username> — Admin: stop that user receiving broadcasts (they must have /start’d the bot once).

/broadcast_allow <user id or @username> — Admin: let that user receive broadcasts again.

———
Customers (not admin-only) in this chat:
/broadcast_off — Stop receiving broadcast announcements.
/broadcast_on — Receive broadcasts again (default).`;

async function sendBotMessage(botToken: string, chatId: number, text: string) {
  const max = 4096;
  for (let i = 0; i < text.length; i += max) {
    const chunk = text.slice(i, i + max);
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("[telegram sendBotMessage]", res.status, errBody.slice(0, 300));
      }
    } catch (e) {
      console.error("[telegram sendBotMessage] fetch failed", e);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Telegram clients often send /cmd@BotUsername — strip the @bot suffix for matching. */
function normalizeTelegramCommandText(raw: string): string {
  return raw.trim().replace(/^(\/\w+)@[\w]+/i, "$1");
}

/** Admin aliases: /kickout → /kick, /bringin → /unban (after @bot strip). */
function normalizeAdminKickAliases(raw: string): string {
  const s = raw.trim();
  if (/^\/kickout(?:\s|$)/i.test(s)) return s.replace(/^\/kickout/i, "/kick");
  if (/^\/bringin(?:\s|$)/i.test(s)) return s.replace(/^\/bringin/i, "/unban");
  return s;
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
  const t = normalizeTelegramCommandText(msg.text ?? "");
  if (t) {
    if (/^\/broadcast_list$/i.test(t)) return false;
    if (/^\/broadcast_(on|off)$/i.test(t)) return false;
    if (/^\/broadcast(?:\s|$)/i.test(t)) return true;
  }
  const c = normalizeTelegramCommandText(msg.caption ?? "");
  if (msg.photo?.length && c && /^\/broadcast/i.test(c)) return true;
  if (msg.video?.file_id && c && /^\/broadcast/i.test(c)) return true;
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
  adminFeedbackToken: string,
  customerSendToken: string,
  adminChatId: number,
  msg: TgMessage,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data: rows, error } = await supabase
    .from("telegram_verifications")
    .select("telegram_user_id")
    .eq("broadcast_opt_in", true);

  if (error) {
    await sendBotMessage(adminFeedbackToken, adminChatId, PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    return;
  }

  const adminId = Number(process.env.ADMIN_TELEGRAM_USER_ID);
  const rawIds = (rows ?? [])
    .map((r) => Number(r.telegram_user_id))
    .filter((n) => Number.isFinite(n) && n > 0);
  const ids = Array.from(new Set(rawIds)).filter((id) => id !== adminId);

  if (ids.length === 0) {
    await sendBotMessage(
      adminFeedbackToken,
      adminChatId,
      "No recipients opted in. Users must use /start (with a username) and not use /broadcast_off."
    );
    return;
  }

  const hasPhoto = Boolean(msg.photo?.length);
  const hasVideo = Boolean(msg.video?.file_id);
  const captionRaw = msg.caption?.trim() ?? "";

  if (hasPhoto) {
    if (!/^\/broadcast(?:@\w+)?/i.test(captionRaw)) {
      await sendBotMessage(
        adminFeedbackToken,
        adminChatId,
        "For photos: add a caption that starts with /broadcast (you can add text after it for the announcement)."
      );
      return;
    }
    const outCaption = stripBroadcastPrefix(normalizeTelegramCommandText(captionRaw));
    const fileId = msg.photo![msg.photo!.length - 1]!.file_id;
    let ok = 0;
    let fail = 0;
    for (const uid of ids) {
      const res = await fetch(`https://api.telegram.org/bot${customerSendToken}/sendPhoto`, {
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
      adminFeedbackToken,
      adminChatId,
      `Photo broadcast: ${ok} delivered${fail ? `, ${fail} failed (blocked bot or deleted chat).` : "."}`
    );
    return;
  }

  if (hasVideo) {
    const capNorm = normalizeTelegramCommandText(captionRaw);
    if (!/^\/broadcast(?:@\w+)?/i.test(capNorm)) {
      await sendBotMessage(
        adminFeedbackToken,
        adminChatId,
        "For videos: add a caption that starts with /broadcast (you can add text after it for the announcement)."
      );
      return;
    }
    const outCaption = stripBroadcastPrefix(capNorm);
    const fileId = msg.video!.file_id;
    let ok = 0;
    let fail = 0;
    for (const uid of ids) {
      const res = await fetch(`https://api.telegram.org/bot${customerSendToken}/sendVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: uid,
          video: fileId,
          ...(outCaption ? { caption: outCaption } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (j.ok) ok++;
      else fail++;
      await sleep(80);
    }
    await sendBotMessage(
      adminFeedbackToken,
      adminChatId,
      `Video broadcast: ${ok} delivered${fail ? `, ${fail} failed (blocked bot or deleted chat).` : "."}`
    );
    return;
  }

  const textRaw = msg.text?.trim() ?? "";
  const announcement = stripBroadcastPrefix(textRaw);
  if (!announcement) {
    await sendBotMessage(
      adminFeedbackToken,
      adminChatId,
      "Usage:\n/broadcast Your message here\n\nOr send a photo with a caption starting with /broadcast (optional text after it)."
    );
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const uid of ids) {
    const res = await fetch(`https://api.telegram.org/bot${customerSendToken}/sendMessage`, {
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
    adminFeedbackToken,
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
  adminReplyToken: string,
  channelBotToken: string,
  adminChatId: number,
  channelId: string | undefined,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!channelId) {
    await sendBotMessage(adminReplyToken, adminChatId, "TELEGRAM_CHANNEL_ID is not set on the server.");
    return;
  }
  const m = /^\/kick\s+(.+)$/i.exec(text.trim());
  const raw = m?.[1]?.trim() ?? "";
  if (!raw) {
    await sendBotMessage(adminReplyToken, adminChatId, "Usage: /kick or /kickout <user id or @username>");
    return;
  }
  const resolved = await resolveTargetUserId(channelBotToken, supabase, raw);
  if ("error" in resolved) {
    await sendBotMessage(adminReplyToken, adminChatId, resolved.error);
    return;
  }
  const r = await banChatMemberApi(channelBotToken, channelId, resolved.id);
  if (r.ok) {
    await sendBotMessage(
      adminReplyToken,
      adminChatId,
      `Removed user ${resolved.id} from the channel (ban). They can be allowed back with /unban or /bringin.`
    );
  } else {
    await sendBotMessage(adminReplyToken, adminChatId, `Telegram: ${r.description ?? "ban failed"}`);
  }
}

async function handleAdminUnban(
  adminReplyToken: string,
  channelBotToken: string,
  adminChatId: number,
  channelId: string | undefined,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!channelId) {
    await sendBotMessage(adminReplyToken, adminChatId, "TELEGRAM_CHANNEL_ID is not set on the server.");
    return;
  }
  const m = /^\/unban\s+(.+)$/i.exec(text.trim());
  const raw = m?.[1]?.trim() ?? "";
  if (!raw) {
    await sendBotMessage(adminReplyToken, adminChatId, "Usage: /unban or /bringin <user id or @username>");
    return;
  }
  const resolved = await resolveTargetUserId(channelBotToken, supabase, raw);
  if ("error" in resolved) {
    await sendBotMessage(adminReplyToken, adminChatId, resolved.error);
    return;
  }
  const r = await unbanChatMemberApi(channelBotToken, channelId, resolved.id);
  if (r.ok) {
    await sendBotMessage(
      adminReplyToken,
      adminChatId,
      `Unbanned user ${resolved.id}. They can rejoin the channel using the invite link.`
    );
  } else {
    await sendBotMessage(adminReplyToken, adminChatId, `Telegram: ${r.description ?? "unban failed"}`);
  }
}

async function handleAdminBroadcastBlock(
  adminReplyToken: string,
  customerLookupToken: string,
  adminChatId: number,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const m = /^\/broadcast_block\s+(.+)$/i.exec(text.trim());
  const raw = m?.[1]?.trim() ?? "";
  if (!raw) {
    await sendBotMessage(adminReplyToken, adminChatId, "Usage: /broadcast_block <user id or @username>");
    return;
  }
  const resolved = await resolveTargetUserId(customerLookupToken, supabase, raw);
  if ("error" in resolved) {
    await sendBotMessage(adminReplyToken, adminChatId, resolved.error);
    return;
  }
  const { data, error } = await supabase
    .from("telegram_verifications")
    .update({ broadcast_opt_in: false })
    .eq("telegram_user_id", resolved.id)
    .select("telegram_user_id");
  if (error) {
    await sendBotMessage(adminReplyToken, adminChatId, PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    return;
  }
  if (!data?.length) {
    await sendBotMessage(
      adminReplyToken,
      adminChatId,
      `No saved bot contact for user id ${resolved.id}. They must send /start to this bot first.`
    );
    return;
  }
  await sendBotMessage(
    adminReplyToken,
    adminChatId,
    `User ${resolved.id} will not receive your broadcasts. Undo with /broadcast_allow <same id or @username>`
  );
}

async function handleAdminBroadcastAllow(
  adminReplyToken: string,
  customerLookupToken: string,
  adminChatId: number,
  text: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const m = /^\/broadcast_allow\s+(.+)$/i.exec(text.trim());
  const raw = m?.[1]?.trim() ?? "";
  if (!raw) {
    await sendBotMessage(adminReplyToken, adminChatId, "Usage: /broadcast_allow <user id or @username>");
    return;
  }
  const resolved = await resolveTargetUserId(customerLookupToken, supabase, raw);
  if ("error" in resolved) {
    await sendBotMessage(adminReplyToken, adminChatId, resolved.error);
    return;
  }
  const { data, error } = await supabase
    .from("telegram_verifications")
    .update({ broadcast_opt_in: true })
    .eq("telegram_user_id", resolved.id)
    .select("telegram_user_id");
  if (error) {
    await sendBotMessage(adminReplyToken, adminChatId, PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    return;
  }
  if (!data?.length) {
    await sendBotMessage(
      adminReplyToken,
      adminChatId,
      `No saved bot contact for user id ${resolved.id}. They must send /start to this bot first.`
    );
    return;
  }
  await sendBotMessage(adminReplyToken, adminChatId, `User ${resolved.id} will receive broadcasts again.`);
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

export async function runTelegramWebhook(request: Request, role: TelegramWebhookRole) {
  const webhookSecret =
    role === "admin" ? getTelegramAdminWebhookSecret() : getTelegramCustomerWebhookSecret();
  const header = request.headers.get("x-telegram-bot-api-secret-token");

  if (webhookSecret && header && header !== webhookSecret) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const inboundToken = role === "admin" ? getTelegramAdminBotToken() : getTelegramCustomerBotToken();
  const customerMessagingToken = getTelegramCustomerBotToken() ?? inboundToken;
  const adminInboundToken = getTelegramAdminBotToken() ?? inboundToken;

  if (!inboundToken || !customerMessagingToken) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 503 });
  }

  const adminReplyToken: string = adminInboundToken ?? inboundToken;
  const customerOutreachToken: string = customerMessagingToken;

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
  }

  if (role === "customer" && update.callback_query) {
    return NextResponse.json({ ok: true });
  }

  // Inline keyboard actions (admin bot only — order approve / decline / give drop)
  const callback = update.callback_query;
  if (callback?.id && callback.from?.id && callback.data) {
    if (role !== "admin") {
      return NextResponse.json({ ok: true });
    }
    const fromId = callback.from.id;
    if (!isAdminTelegram(fromId)) {
      await fetch(`https://api.telegram.org/bot${inboundToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callback.id, text: "Not authorized." }),
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    const svc = createServiceClient();
    const [cmd, orderId] = callback.data.split(":", 2) as [string, string];

    let answerText = "Action failed.";
    try {
      if (!orderId) throw new Error("Missing order id");

      if (cmd === "HW_APPROVE") {
        const result = await executeAdminApproveOrder(orderId);
        answerText = result.success ? "Payment approved ✓" : String(result.error ?? "Could not approve.");
      } else if (cmd === "HW_DECLINE") {
        const reason = "Declined in admin bot";
        const { data: order, error: fetchErr } = await svc
          .from("orders")
          .select("id, status, customer_token, order_number")
          .eq("id", orderId)
          .maybeSingle();
        if (fetchErr || !order) throw new Error("Order not found");

        const st = String(order.status);
        if (st !== "payment_pending" && st !== "awaiting_dead_drop") throw new Error("Order not pending approval");
        const awaitingDrop = st === "awaiting_dead_drop";

        const now = new Date().toISOString();
        const { error: upErr } = await svc
          .from("orders")
          .update({
            status: "cancelled",
            updated_at: now,
            rejection_reason: sanitizePlainText(reason, 2000) || null,
          })
          .eq("id", orderId)
          .in("status", awaitingDrop ? ["awaiting_dead_drop"] : ["payment_pending"]);

        if (upErr) throw upErr;

        const customerToken = order.customer_token as string | undefined;
        const orderNumber = (order.order_number as string | undefined) ?? orderId.slice(0, 8);
        if (customerToken) {
          void notifyCustomerPush(customerToken, {
            title: "Order update",
            body: `Order ${orderNumber} was not approved. Contact support if you have questions.`,
            url: "/home",
            tag: `reject-${orderId}`,
          });
        }

        answerText = "Declined ✓";
      } else if (cmd === "HW_GIVE_DROP") {
        answerText =
          "Use the admin dashboard → Orders: open Issue parcel locker and enter location + passcode. Telegram quick-assign is disabled.";
      } else {
        answerText = "Unknown action.";
      }
    } catch (e) {
      console.error("[telegram admin inline action]", e);
      answerText = "Action failed (order state may not match).";
    }

    await fetch(`https://api.telegram.org/bot${inboundToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback.id, text: answerText }),
    }).catch(() => {});

    return NextResponse.json({ ok: true });
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
  const text = normalizeTelegramCommandText(msg.text ?? "");
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  const supabase = createServiceClient();

  if (role === "admin") {
    if (!isAdminTelegram(from.id)) {
      await sendBotMessage(
        adminReplyToken,
        chatId,
        "This bot is for internal use only. For Honey Well customer support, use the options linked from the shop website."
      );
      return NextResponse.json({ ok: true });
    }
    const t = normalizeAdminKickAliases(normalizeTelegramCommandText(text)).trim();
    /** /start had no handler — Telegram often sends it first; admins saw silence. */
    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(t)) {
      await sendBotMessage(
        adminReplyToken,
        chatId,
        "Honey Well — admin bot (you are authorized).\n\nSend /lists for all commands, or /rules for full help."
      );
      return NextResponse.json({ ok: true });
    }
    if (/^\/lists?$/i.test(t)) {
      await sendBotMessage(adminReplyToken, chatId, LISTS_COMMANDS_TEXT);
      return NextResponse.json({ ok: true });
    }
    if (/^\/rules$/i.test(t)) {
      await sendBotMessage(adminReplyToken, chatId, ADMIN_RULES_TEXT);
      return NextResponse.json({ ok: true });
    }
    if (/^\/broadcast_list$/i.test(t)) {
      await handleBroadcastList(adminReplyToken, chatId, supabase);
      return NextResponse.json({ ok: true });
    }
    if (/^\/kick\s+/i.test(t)) {
      await handleAdminKick(adminReplyToken, customerOutreachToken, chatId, channelId, t, supabase);
      return NextResponse.json({ ok: true });
    }
    if (/^\/unban\s+/i.test(t)) {
      await handleAdminUnban(adminReplyToken, customerOutreachToken, chatId, channelId, t, supabase);
      return NextResponse.json({ ok: true });
    }
    if (/^\/broadcast_block\s+/i.test(t)) {
      await handleAdminBroadcastBlock(adminReplyToken, customerOutreachToken, chatId, t, supabase);
      return NextResponse.json({ ok: true });
    }
    if (/^\/broadcast_allow\s+/i.test(t)) {
      await handleAdminBroadcastAllow(adminReplyToken, customerOutreachToken, chatId, t, supabase);
      return NextResponse.json({ ok: true });
    }
    if (isMassBroadcastIntent(msg)) {
      await handleBroadcast(adminReplyToken, customerOutreachToken, chatId, msg, supabase);
      return NextResponse.json({ ok: true });
    }
    if (/^\/\S+/.test(t)) {
      await sendBotMessage(
        adminReplyToken,
        chatId,
        "Unknown command. Send /lists for the admin menu.\n\nIf every command is silent: webhook must be …/api/telegram/webhook/admin (not the customer URL), and ADMIN_TELEGRAM_USER_ID must match your Telegram user id."
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  }

  const hasUsername = Boolean(from.username?.trim());
  if (!hasUsername) {
    await sendBotMessage(inboundToken, chatId, USERNAME_REQUIRED_MESSAGE);
    return NextResponse.json({ ok: true });
  }

  const tUser = normalizeAdminKickAliases(normalizeTelegramCommandText(text)).trim();
  if (
    isMassBroadcastIntent(msg) ||
    /^\/broadcast_list$/i.test(tUser) ||
    /^\/lists?$/i.test(tUser) ||
    /^\/rules$/i.test(tUser) ||
    /^\/kick\s/i.test(tUser) ||
    /^\/unban\s/i.test(tUser) ||
    /^\/broadcast_block\s/i.test(tUser) ||
    /^\/broadcast_allow\s/i.test(tUser)
  ) {
    await sendBotMessage(inboundToken, chatId, "That command is for Honey Well admins only.");
    return NextResponse.json({ ok: true });
  }

  if (/^\/broadcast_off$/i.test(tUser)) {
    const { data, error } = await supabase
      .from("telegram_verifications")
      .update({ broadcast_opt_in: false })
      .eq("telegram_user_id", from.id)
      .select("telegram_user_id");
    if (error || !data?.length) {
      await sendBotMessage(inboundToken, chatId, "You’re not registered yet. Send /start first.");
    } else {
      await sendBotMessage(
        inboundToken,
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
      await sendBotMessage(inboundToken, chatId, "You’re not registered yet. Send /start first.");
    } else {
      await sendBotMessage(inboundToken, chatId, "You’ll receive broadcast announcements from Honey Well again.");
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
        inboundToken,
        chatId,
        "This link is invalid or expired. Go back to the Honey Well site, enter your username, and tap Verify again."
      );
      return NextResponse.json({ ok: true });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabase.from("telegram_verify_tokens").delete().eq("token", token);
      await sendBotMessage(
        inboundToken,
        chatId,
        "This link expired. Go back to the site and tap Verify again to get a new link."
      );
      return NextResponse.json({ ok: true });
    }

    const expected = row.telegram_username.trim().toLowerCase();
    if (tgUser !== expected) {
      await sendBotMessage(
        inboundToken,
        chatId,
        `This link is for @${expected}. You’re logged into Telegram as @${tgUser}. Use the account that matches what you typed on the website.`
      );
      return NextResponse.json({ ok: true });
    }

    const { channelMember } = await sendStartMembershipReply(
      inboundToken,
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
      await sendBotMessage(inboundToken, chatId, FIRST_CONTACT_COMMUNITY_MESSAGE);
    }
    const { channelMember } = await sendStartMembershipReply(inboundToken, channelId, chatId, from.id);
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

  // Slash commands that did not match any handler above used to get no reply (e.g. /list vs /lists).
  if (/^\/\S+$/.test(tUser)) {
    await sendBotMessage(
      inboundToken,
      chatId,
      "Unknown command. Send /start to connect with Honey Well."
    );
  }

  return NextResponse.json({ ok: true });
}
