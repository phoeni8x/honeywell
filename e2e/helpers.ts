import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** True when tests target live https://teamruby.net (no server-side E2E approve secret). */
export function isTeamrubyProductionBase(): boolean {
  const b = (process.env.PLAYWRIGHT_BASE_URL || "").trim();
  return /^https?:\/\/(www\.)?teamruby\.net\b/i.test(b);
}

/** First active product id from shop listing (fallback when E2E_PRODUCT_ID unset). */
export async function discoverFirstProductId(page: Page): Promise<string> {
  await page.goto("/shop");
  const link = page.locator('a[href*="/product/"]').first();
  await link.waitFor({ state: "visible", timeout: 45_000 });
  const href = await link.getAttribute("href");
  const m = href?.match(/\/product\/([^/?#]+)/);
  if (!m?.[1]) throw new Error(`Could not parse product id from shop link: ${href ?? ""}`);
  return m[1];
}

function proceedCheckoutBtn(page: Page) {
  return page.getByTestId("proceed-to-checkout").or(page.getByRole("button", { name: /Proceed to checkout/i }));
}

function checkoutDeadDropContinue(page: Page) {
  return page.getByTestId("checkout-parcel-locker-continue").or(page.getByRole("button", { name: /^Continue$/i }));
}

function checkoutReviewOrder(page: Page) {
  return page.getByTestId("checkout-review-order").or(page.getByRole("button", { name: /Review order/i }));
}

function checkoutPlaceOrder(page: Page) {
  return page.getByTestId("checkout-place-order").or(page.getByRole("button", { name: /Place order/i }));
}

export function cryptoSentPaymentBtn(page: Page) {
  return page.getByTestId("crypto-ive-sent-payment").or(page.getByRole("button", { name: /I've sent payment|I’ve sent payment/i }));
}

export async function assertOrderExistsForCustomer(
  request: APIRequestContext,
  orderId: string,
  customerToken: string
) {
  const res = await request.get(`/api/account/orders/${encodeURIComponent(orderId)}`, {
    headers: { "x-customer-token": customerToken },
  });
  expect(res.ok(), `account order fetch failed: ${res.status()}`).toBeTruthy();
  const json = (await res.json()) as { order?: { id?: string; status?: string } };
  expect(json.order?.id || orderId).toBeTruthy();
  return json.order?.status ?? "";
}

/** After UI lands on /pay/crypto — confirm payment via the real API (E2E branch runs admin approve). */
export async function confirmCryptoPaymentForE2E(
  request: APIRequestContext,
  orderId: string,
  e2eSecret: string
) {
  const res = await request.post("/api/verify-crypto-payment", {
    data: { order_id: orderId, e2e_confirm_secret: e2eSecret },
  });
  expect(res.ok(), `verify-crypto-payment failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { status?: string; e2e_auto_approve?: boolean };
  expect(body.status).toBe("approved");
  expect(body.e2e_auto_approve).toBe(true);
}

export async function assertOrderNoLongerPending(
  request: APIRequestContext,
  orderId: string,
  customerToken: string
) {
  const res = await request.get(`/api/account/orders/${encodeURIComponent(orderId)}`, {
    headers: { "x-customer-token": customerToken },
  });
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as { order?: { status?: string } };
  const st = json.order?.status ?? "";
  expect(st).not.toBe("payment_pending");
  const progressed = [
    "awaiting_dead_drop",
    "confirmed",
    "ready_at_drop",
    "ready_for_pickup",
    "delivered",
    "picked_up",
  ];
  expect(progressed).toContain(st);
}

/** Guest path: seed guest tier (splash no longer offers guest — same as browser-only guest state). */
export async function runGuestCheckoutUi(page: Page, productId: string) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("honeywell_user_type", "guest");
    localStorage.removeItem("honeywell_telegram_username");
  });
  await page.goto(`/product/${productId}`);
  await proceedCheckoutBtn(page).click();
  await checkoutDeadDropContinue(page).click({ timeout: 45_000 });
  await checkoutReviewOrder(page).click();
  await checkoutPlaceOrder(page).click();
  await page.waitForURL(/\/pay\/crypto/, { timeout: 90_000 });
}

/** VIP path: browser already has team_member + Telegram username (simulates post–Telegram verify). Crypto pay matches guest E2E approve flow. */
export async function runVipCheckoutUi(page: Page, productId: string) {
  await page.goto(`/product/${productId}`);
  const priceEl = page.getByTestId("product-display-price").or(page.locator(".price"));
  await expect(priceEl.first()).toBeVisible({ timeout: 30_000 });
  await proceedCheckoutBtn(page).click();
  await checkoutDeadDropContinue(page).click({ timeout: 45_000 });
  const revolut = page.getByTestId("checkout-pay-revolut").or(page.getByRole("button", { name: /Bank transfer/i }));
  await expect(revolut.first()).toBeVisible();
  const crypto = page.getByTestId("checkout-pay-crypto").or(page.getByRole("button", { name: /^Crypto$/i }));
  await crypto.first().click();
  await checkoutReviewOrder(page).click();
  await checkoutPlaceOrder(page).click();
  await page.waitForURL(/\/pay\/crypto/, { timeout: 90_000 });
}

export function orderIdFromPayUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  const id = u.searchParams.get("orderId");
  if (!id) throw new Error(`No orderId in ${pageUrl}`);
  return id;
}
