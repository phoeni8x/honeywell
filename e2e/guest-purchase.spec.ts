import { test, expect } from "@playwright/test";
import {
  assertOrderNoLongerPending,
  confirmCryptoPaymentForE2E,
  orderIdFromPayUrl,
  runGuestCheckoutUi,
} from "./helpers";

test.describe("Guest purchase (crypto + E2E approve)", () => {
  test("guest completes checkout and order is approved via payment API", async ({ page, request }) => {
    const productId = process.env.E2E_PRODUCT_ID?.trim();
    const secret = process.env.E2E_PAYMENT_APPROVE_SECRET?.trim();
    test.skip(!productId, "Set E2E_PRODUCT_ID to a real product UUID (see .env.local.example).");
    test.skip(!secret || secret.length < 16, "Set E2E_PAYMENT_APPROVE_SECRET (min 16 chars) for E2E approve path.");

    await runGuestCheckoutUi(page, productId!);
    const orderId = orderIdFromPayUrl(page.url());
    const token = await page.evaluate(() => localStorage.getItem("honeywell_customer_token"));
    expect(token && token.length >= 8).toBeTruthy();

    await confirmCryptoPaymentForE2E(request, orderId, secret!);
    await assertOrderNoLongerPending(request, orderId, token!);
  });
});
