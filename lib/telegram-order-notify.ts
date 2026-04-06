import { getTelegramAdminBotToken } from "@/lib/telegram-bot-tokens";
import { sendTelegramMessage } from "@/lib/telegram";

export type TelegramOrderNotifyParams = {
  orderId: string;
  customerUsername: string | null;
  deliveryAddress: string | null;
  orderAmount: number | string | null;
  productType: string | null;
  paymentReferenceCode: string | null;
  /** Parcel locker off — no inline payment approve; manage in admin as pre-order / booking. */
  bookingWithoutPayment?: boolean;
  /** Optional first line (e.g. demo seed disclaimer). */
  banner?: string;
};

/**
 * Sends the standard admin Telegram message for a new order (inline approve / decline).
 * Uses TELEGRAM_ADMIN_BOT_TOKEN (or TELEGRAM_BOT_TOKEN) and TELEGRAM_ORDER_CHAT_ID or ADMIN_TELEGRAM_USER_ID.
 */
export async function notifyTelegramNewOrder(params: TelegramOrderNotifyParams): Promise<void> {
  const botToken = getTelegramAdminBotToken();
  const chatId = process.env.TELEGRAM_ORDER_CHAT_ID?.trim() || process.env.ADMIN_TELEGRAM_USER_ID?.trim();
  if (!botToken || !chatId) {
    console.warn(
      "[notifyTelegramNewOrder] skipped: set TELEGRAM_ADMIN_BOT_TOKEN (or TELEGRAM_BOT_TOKEN) and TELEGRAM_ORDER_CHAT_ID or ADMIN_TELEGRAM_USER_ID on the server"
    );
    return;
  }

  const username = params.customerUsername ? `@${params.customerUsername.replace(/^@/, "")}` : "N/A";
  const address = params.deliveryAddress?.trim() || "N/A";
  const amountNum = params.orderAmount == null ? NaN : Number(params.orderAmount);
  const amount = Number.isFinite(amountNum) ? String(amountNum) : "N/A";
  const product = params.productType?.trim() || "N/A";
  const payRef = params.paymentReferenceCode?.trim() || "N/A";

  const body = params.bookingWithoutPayment
    ? [
        "New booking request (parcel locker checkout paused — no payment yet)",
        `1) Customer username: ${username}`,
        `2) Location / notes: ${address}`,
        `3) Quoted total (pay later if accepted): ${amount}`,
        `4) Product: ${product}`,
        `5) Payment: none yet — use Admin → Orders (pre-order) to accept or cancel.`,
      ].join("\n")
    : [
        "New customer order",
        `1) Customer username: ${username}`,
        `2) Location / notes: ${address}`,
        `3) Customer amount (total): ${amount}`,
        `4) Product type: ${product}`,
        `5) Payment reference (bank transfer / crypto memo): ${payRef}`,
      ].join("\n");

  const message = params.banner ? `${params.banner}\n\n${body}` : body;

  const keyboard = params.bookingWithoutPayment
    ? undefined
    : {
        inline_keyboard: [
          [
            { text: "✅ Accept payment", callback_data: `HW_APPROVE:${params.orderId}` },
            { text: "❌ Decline", callback_data: `HW_DECLINE:${params.orderId}` },
          ],
        ],
      };

  const tg = await sendTelegramMessage(botToken, chatId, message, keyboard ? { replyMarkup: keyboard } : undefined);
  if (!tg.ok) {
    console.error("[telegram order notify]", tg.description ?? "sendMessage failed");
  }
}
