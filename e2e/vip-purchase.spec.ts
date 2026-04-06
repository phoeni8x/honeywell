import { test, expect } from "@playwright/test";
import {
  assertOrderNoLongerPending,
  assertOrderExistsForCustomer,
  confirmCryptoPaymentForE2E,
  discoverFirstProductId,
  isTeamrubyProductionBase,
  orderIdFromPayUrl,
  runVipCheckoutUi,
} from "./helpers";

test.describe("VIP purchase (rehllic / team_member)", () => {
  test("VIP checkout bank transfer → order history (rehllic handle)", async ({ page, context, request }) => {
    const remote = isTeamrubyProductionBase();
    const secret = process.env.E2E_PAYMENT_APPROVE_SECRET?.trim();
    const vipUsername = (process.env.E2E_VIP_TELEGRAM_USERNAME || "rehllic").trim().toLowerCase();

    await context.addInitScript(
      ([utKey, utVal, tgKey, tgVal]) => {
        localStorage.setItem(utKey, utVal);
        localStorage.setItem(tgKey, tgVal);
      },
      ["honeywell_user_type", "team_member", "honeywell_telegram_username", vipUsername] as const
    );

    let productId = process.env.E2E_PRODUCT_ID?.trim();
    if (!productId) {
      test.skip(!remote, "Set E2E_PRODUCT_ID for local runs, or use PLAYWRIGHT_BASE_URL=https://teamruby.net.");
      productId = await discoverFirstProductId(page);
    }

    // App has no Supabase password for VIP — tier is Telegram-verified team_member; E2E seeds post-verify state.
    await runVipCheckoutUi(page, productId!);
    const orderId = orderIdFromPayUrl(page.url());
    const token = await page.evaluate(() => localStorage.getItem("honeywell_customer_token"));
    expect(token && token.length >= 8).toBeTruthy();

    if (remote) {
      await page.waitForURL(/\/order-history/, { timeout: 60_000 });
      const st = await assertOrderExistsForCustomer(request, orderId, token!);
      expect(st).toBe("payment_pending");
    } else {
      test.skip(!secret || secret.length < 16, "Local/preview: set E2E_PAYMENT_APPROVE_SECRET for full approve.");
      await confirmCryptoPaymentForE2E(request, orderId, secret!);
      await assertOrderNoLongerPending(request, orderId, token!);
    }
  });

  test("VIP display price uses team tier when prices differ (teamruby.net)", async ({ browser }) => {
    test.skip(!isTeamrubyProductionBase(), "Runs only against teamruby.net.");
    const base = process.env.PLAYWRIGHT_BASE_URL!.replace(/\/$/, "");

    const ctxDiscover = await browser.newContext();
    const discoverPage = await ctxDiscover.newPage();
    const productId =
      process.env.E2E_PRODUCT_ID?.trim() || (await discoverFirstProductId(discoverPage));
    await ctxDiscover.close();

    const ctxVip = await browser.newContext();
    await ctxVip.addInitScript(
      ([utKey, utVal, tgKey, tgVal]) => {
        localStorage.setItem(utKey, utVal);
        localStorage.setItem(tgKey, tgVal);
      },
      ["honeywell_user_type", "team_member", "honeywell_telegram_username", "rehllic"] as const
    );
    const vipPage = await ctxVip.newPage();
    await vipPage.goto(`${base}/product/${productId}`);
    const vipPrice = (await vipPage.getByTestId("product-display-price").or(vipPage.locator(".price")).first().innerText()).trim();
    await ctxVip.close();

    const ctxGuest = await browser.newContext();
    await ctxGuest.addInitScript(([utKey, utVal]) => localStorage.setItem(utKey, utVal), [
      "honeywell_user_type",
      "guest",
    ] as const);
    const guestPage = await ctxGuest.newPage();
    await guestPage.goto(`${base}/product/${productId}`);
    const guestPrice = (
      await guestPage.getByTestId("product-display-price").or(guestPage.locator(".price")).first().innerText()
    ).trim();
    await ctxGuest.close();

    expect(vipPrice.length).toBeGreaterThan(0);
    expect(guestPrice.length).toBeGreaterThan(0);
    if (vipPrice !== guestPrice) {
      const parseHuf = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;
      expect(parseHuf(vipPrice)).toBeLessThanOrEqual(parseHuf(guestPrice));
    }
  });
});
