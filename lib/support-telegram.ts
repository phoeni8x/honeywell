/**
 * Telegram support link (Honey Well bot). Uses NEXT_PUBLIC_SUPPORT_TELEGRAM_URL if set,
 * otherwise builds from NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (same as verify-telegram).
 */
export function getSupportTelegramUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ?? "Honeyywell_bot";
  return `https://t.me/${bot}`;
}

/** Deep link with /start payload (max 64 chars for Telegram). */
export function getTelegramStartUrl(payload: string): string {
  const base = getSupportTelegramUrl();
  const p = payload.trim();
  if (!p || p.length > 64) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}start=${encodeURIComponent(p)}`;
}

export function getOrderIssueTelegramUrl(orderId: string): string {
  return getTelegramStartUrl(`order_${orderId}`);
}
