/**
 * Telegram Bot API helpers — channel membership (same rules as /api/verify-telegram).
 */

/** getChatMember statuses that count as "in channel" for team verification. */
export function isChannelMemberStatus(status: string | undefined): boolean {
  return (
    status === "member" ||
    status === "administrator" ||
    status === "creator" ||
    status === "restricted"
  );
}

export async function getChannelMembership(
  botToken: string,
  channelId: string,
  userId: number
): Promise<{ ok: true; member: boolean } | { ok: false; error: string }> {
  const memberUrl = new URL(`https://api.telegram.org/bot${botToken}/getChatMember`);
  memberUrl.searchParams.set("chat_id", channelId);
  memberUrl.searchParams.set("user_id", String(userId));
  const tgRes = await fetch(memberUrl.toString());
  let data: unknown;
  try {
    data = await tgRes.json();
  } catch {
    return { ok: false, error: "Telegram returned an unexpected response." };
  }
  const d = data as { ok?: boolean; result?: { status?: string }; description?: string };
  if (!d.ok) {
    return { ok: false, error: d.description || "Telegram API error" };
  }
  return { ok: true, member: isChannelMemberStatus(d.result?.status) };
}

type TgOk = { ok: boolean; description?: string };

export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string
): Promise<TgOk> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
  return (await res.json()) as TgOk;
}

export async function banChatMemberApi(
  botToken: string,
  chatId: string,
  userId: number
): Promise<TgOk> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  });
  return (await res.json()) as TgOk;
}

export async function unbanChatMemberApi(
  botToken: string,
  chatId: string,
  userId: number
): Promise<TgOk> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, only_if_banned: false }),
  });
  return (await res.json()) as TgOk;
}

/** Resolve @username via Bot API getChat (user must exist for Telegram). */
export async function getTelegramUserIdByUsername(
  botToken: string,
  usernameWithoutAt: string
): Promise<number | null> {
  const u = usernameWithoutAt.replace(/^@/, "").trim();
  if (!u) return null;
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent("@" + u)}`
  );
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const d = data as { ok?: boolean; result?: { id?: number } };
  if (!d.ok || d.result?.id == null) return null;
  return Number(d.result.id);
}
