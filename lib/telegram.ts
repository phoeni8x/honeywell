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
