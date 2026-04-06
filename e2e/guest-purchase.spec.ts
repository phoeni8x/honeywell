import { test, expect } from "@playwright/test";
import {
  assertOrderNoLongerPending,
  assertOrderExistsForCustomer,
  confirmCryptoPaymentForE2E,
  cryptoSentPaymentBtn,
  discoverFirstProductId,
  isTeamrubyProductionBase,
  orderIdFromPayUrl,
  runGuestCheckoutUi,
} from "./helpers";

test.describe.skip("Guest purchase (crypto payment handler)", () => {
  test("guest completes checkout and payment handler + order record", async ({ page, request }) => {
    const remote = isTeamrubyProductionBase();
    const secret = process.env.E2E_PAYMENT_APPROVE_SECRET?.trim();
    let productId = process.env.E2E_PRODUCT_ID?.trim();
    if (!productId) {
      test.skip(!remote, "Set E2E_PRODUCT_ID for local runs, or use PLAYWRIGHT_BASE_URL=https://teamruby.net to auto-pick from shop.");
      productId = await discoverFirstProductId(page);
    }

    await runGuestCheckoutUi(page, productId);
    const orderId = orderIdFromPayUrl(page.url());
    const token = await page.evaluate(() => localStorage.getItem("honeywell_customer_token"));
    expect(token && token.length >= 8).toBeTruthy();

    if (remote) {
      // Live site: same POST /api/verify-crypto-payment as the “I’ve sent payment” button (pending until admin confirms).
      await cryptoSentPaymentBtn(page).click();
      await page.waitForURL(/\/order-history/, { timeout: 45_000 });
      const st = await assertOrderExistsForCustomer(request, orderId, token!);
      expect(st).toBe("payment_pending");
      await expect(page.getByText(/order|Order|history/i).first()).toBeVisible({ timeout: 20_000 });
    } else {
      test.skip(!secret || secret.length < 16, "Local/preview: set E2E_PAYMENT_APPROVE_SECRET for full approve.");
      await confirmCryptoPaymentForE2E(request, orderId, secret!);
      await assertOrderNoLongerPending(request, orderId, token!);
    }
  });
});
