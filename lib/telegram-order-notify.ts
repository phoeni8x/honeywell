import { sendTelegramMessage } from "@/lib/telegram";

export type TelegramOrderNotifyParams = {
  orderId: string;
  customerUsername: string | null;
  deliveryAddress: string | null;
  orderAmount: number | string | null;
  productType: string | null;
  paymentReferenceCode: string | null;
  /** Optional first line (e.g. demo seed disclaimer). */
  banner?: string;
};

/**
 * Sends the standard admin Telegram message for a new order (inline approve / decline / give drop).
 * Uses TELEGRAM_BOT_TOKEN and TELEGRAM_ORDER_CHAT_ID or ADMIN_TELEGRAM_USER_ID.
 */
export async function notifyTelegramNewOrder(params: TelegramOrderNotifyParams): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ORDER_CHAT_ID?.trim() || process.env.ADMIN_TELEGRAM_USER_ID?.trim();
  if (!botToken || !chatId) return;

  const username = params.customerUsername ? `@${params.customerUsername.replace(/^@/, "")}` : "N/A";
  const address = params.deliveryAddress?.trim() || "N/A";
  const amountNum = params.orderAmount == null ? NaN : Number(params.orderAmount);
  const amount = Number.isFinite(amountNum) ? String(amountNum) : "N/A";
  const product = params.productType?.trim() || "N/A";
  const payRef = params.paymentReferenceCode?.trim() || "N/A";

  const body = [
    "New customer order",
    `1) Customer username: ${username}`,
    `2) Location / notes: ${address}`,
    `3) Customer amount (total): ${amount}`,
    `4) Product type: ${product}`,
    `5) Payment reference (bank transfer / crypto memo): ${payRef}`,
  ].join("\n");

  const message = params.banner ? `${params.banner}\n\n${body}` : body;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Accept payment", callback_data: `HW_APPROVE:${params.orderId}` },
        { text: "❌ Decline", callback_data: `HW_DECLINE:${params.orderId}` },
      ],
      [{ text: "📦 Give drop", callback_data: `HW_GIVE_DROP:${params.orderId}` }],
    ],
  };

  const tg = await sendTelegramMessage(botToken, chatId, message, { replyMarkup: keyboard });
  if (!tg.ok) {
    console.error("[telegram order notify]", tg.description ?? "sendMessage failed");
  }
}
