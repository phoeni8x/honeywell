import { requireAdminUser } from "@/lib/admin-auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { NextResponse } from "next/server";

function buildOrderTelegramMessage(params: {
  customerUsername: string | null | undefined;
  deliveryAddress: string | null | undefined;
  orderAmount: number | string | null | undefined;
  productType: string | null | undefined;
}) {
  const username = params.customerUsername ? `@${String(params.customerUsername).replace(/^@/, "")}` : "N/A";
  const address = params.deliveryAddress?.trim() ? String(params.deliveryAddress).trim() : "N/A";
  const amountNum = params.orderAmount == null ? NaN : Number(params.orderAmount);
  const amount = Number.isFinite(amountNum) ? String(amountNum) : "N/A";
  const product = params.productType?.trim() ? String(params.productType).trim() : "N/A";

  return [
    "New customer order",
    `1) Customer username: ${username}`,
    `2) Delivery address: ${address}`,
    `3) Customer amount (total): ${amount}`,
    `4) Product type: ${product}`,
  ].join("\n");
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    customerUsername?: string;
    deliveryAddress?: string;
    orderAmount?: number | string;
    productType?: string;
  };

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ORDER_CHAT_ID?.trim() || process.env.ADMIN_TELEGRAM_USER_ID?.trim();
  if (!botToken || !chatId) {
    return NextResponse.json({ error: "Telegram order notifications not configured" }, { status: 400 });
  }

  const sample = buildOrderTelegramMessage({
    customerUsername: body.customerUsername ?? "test_customer",
    deliveryAddress: body.deliveryAddress ?? "Test address / notes",
    orderAmount: body.orderAmount ?? 12345,
    productType: body.productType ?? "Test product",
  });

  const message = [
    "🧪 TEST — Honey Well order alert",
    "If you see this, server TELEGRAM_BOT_TOKEN and TELEGRAM_ORDER_CHAT_ID (or ADMIN_TELEGRAM_USER_ID) are working.",
    "",
    sample,
  ].join("\n");

  const tg = await sendTelegramMessage(botToken, chatId, message);
  if (!tg.ok) {
    return NextResponse.json({ error: tg.description ?? "Telegram sendMessage failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, chatId });
}

