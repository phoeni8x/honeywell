import { test, expect } from "@playwright/test";
import {
  assertOrderNoLongerPending,
  confirmCryptoPaymentForE2E,
  orderIdFromPayUrl,
  runVipCheckoutUi,
} from "./helpers";

test.describe("VIP purchase (rehllic / team_member)", () => {
  test("VIP sees team-only payment option and completes crypto checkout + E2E approve", async ({ page, context, request }) => {
    const productId = process.env.E2E_PRODUCT_ID?.trim();
    const secret = process.env.E2E_PAYMENT_APPROVE_SECRET?.trim();
    const vipUsername = (process.env.E2E_VIP_TELEGRAM_USERNAME || "rehllic").trim().toLowerCase();

    test.skip(!productId, "Set E2E_PRODUCT_ID (see .env.local.example).");
    test.skip(!secret || secret.length < 16, "Set E2E_PAYMENT_APPROVE_SECRET (min 16 chars).");

    // Simulates a browser that already passed Telegram VIP verify (no password in this app — tier is team_member + handle).
    await context.addInitScript(
      ([utKey, utVal, tgKey, tgVal]) => {
        localStorage.setItem(utKey, utVal);
        localStorage.setItem(tgKey, tgVal);
      },
      ["honeywell_user_type", "team_member", "honeywell_telegram_username", vipUsername] as const
    );

    await runVipCheckoutUi(page, productId!);
    const orderId = orderIdFromPayUrl(page.url());
    const token = await page.evaluate(() => localStorage.getItem("honeywell_customer_token"));
    expect(token && token.length >= 8).toBeTruthy();

    await confirmCryptoPaymentForE2E(request, orderId, secret!);
    await assertOrderNoLongerPending(request, orderId, token!);
  });
});
