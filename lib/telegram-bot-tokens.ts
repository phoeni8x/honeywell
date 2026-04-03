/**
 * Split Telegram bots: admin (orders + commands) vs customer (DMs, verify, broadcasts).
 * Backward compatible: if only TELEGRAM_BOT_TOKEN is set, it is used for both roles.
 */

export function getTelegramAdminBotToken(): string | undefined {
  const a = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim();
  if (a) return a;
  return process.env.TELEGRAM_BOT_TOKEN?.trim();
}

export function getTelegramCustomerBotToken(): string | undefined {
  const c = process.env.TELEGRAM_CUSTOMER_BOT_TOKEN?.trim();
  if (c) return c;
  return process.env.TELEGRAM_BOT_TOKEN?.trim();
}

/** Webhook secret for the admin bot (setWebhook secret_token). */
export function getTelegramAdminWebhookSecret(): string | undefined {
  return process.env.TELEGRAM_ADMIN_WEBHOOK_SECRET?.trim() || process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
}

/** Webhook secret for the customer / Honey Well bot. */
export function getTelegramCustomerWebhookSecret(): string | undefined {
  return process.env.TELEGRAM_CUSTOMER_WEBHOOK_SECRET?.trim() || process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
}
