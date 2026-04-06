import type { SupabaseClient } from "@supabase/supabase-js";
import { getTelegramCustomerBotToken } from "@/lib/telegram-bot-tokens";
import { buildLockerCustomerMessageHtml } from "@/lib/telegram-html";
import { lockerProviderDisplayLabel } from "@/lib/parcel-locker";

export async function resolveCustomerTelegramChatId(
  svc: SupabaseClient,
  customerToken: string,
  customerUsername: string | null | undefined
): Promise<number | null> {
  const token = customerToken.trim();
  if (token.startsWith("tg_")) {
    const parsed = Number(token.slice(3));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const username = customerUsername?.replace(/^@/, "").toLowerCase().trim();
  if (username) {
    const { data: tv } = await svc
      .from("telegram_verifications")
      .select("telegram_user_id")
      .eq("telegram_username", username)
      .maybeSingle();
    if (tv?.telegram_user_id != null) {
      const tid = Number(tv.telegram_user_id);
      if (Number.isFinite(tid) && tid > 0) return tid;
    }
  }
  return null;
}

/** Best-effort Telegram DM when a parcel locker is issued. */
export async function notifyCustomerLockerViaTelegram(opts: {
  svc: SupabaseClient;
  orderNumber: string;
  productName: string;
  quantity: number;
  lockerProvider: string | null;
  lockerLocationText: string;
  lockerPasscode: string;
  customerToken: string;
  customerUsername: string | null | undefined;
}): Promise<void> {
  const botToken = getTelegramCustomerBotToken()?.trim();
  if (!botToken) return;

  const chatId = await resolveCustomerTelegramChatId(
    opts.svc,
    opts.customerToken,
    opts.customerUsername
  );
  if (!chatId) return;

  const html = buildLockerCustomerMessageHtml({
    orderNumber: opts.orderNumber,
    productName: opts.productName,
    quantity: opts.quantity,
    providerLabel: lockerProviderDisplayLabel(opts.lockerProvider),
    locationText: opts.lockerLocationText.trim(),
    passcode: opts.lockerPasscode.trim(),
  });

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
    }),
  }).catch((e) => console.error("[notifyCustomerLockerViaTelegram]", e));
}
