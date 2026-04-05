import { expect, type APIRequestContext, type Page } from "@playwright/test";

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

/** Guest path: splash → Continue as Guest → product checkout. */
export async function runGuestCheckoutUi(page: Page, productId: string) {
  await page.goto("/");
  await page.getByTestId("continue-as-guest").click();
  await page.waitForURL(/\/home/);
  await page.goto(`/product/${productId}`);
  await page.getByTestId("proceed-to-checkout").click();
  await page.getByTestId("checkout-dead-drop-continue").click({ timeout: 30_000 });
  await page.getByTestId("checkout-review-order").click();
  await page.getByTestId("checkout-place-order").click();
  await page.waitForURL(/\/pay\/crypto/, { timeout: 60_000 });
}

/** VIP path: browser already has team_member + Telegram username (simulates post–Telegram verify). Crypto pay matches guest E2E approve flow. */
export async function runVipCheckoutUi(page: Page, productId: string) {
  await page.goto(`/product/${productId}`);
  await expect(page.getByTestId("product-display-price")).toHaveAttribute("data-user-type", "team_member");
  await page.getByTestId("proceed-to-checkout").click();
  await page.getByTestId("checkout-dead-drop-continue").click({ timeout: 30_000 });
  await expect(page.getByTestId("checkout-pay-revolut")).toBeVisible();
  await page.getByTestId("checkout-pay-crypto").click();
  await page.getByTestId("checkout-review-order").click();
  await page.getByTestId("checkout-place-order").click();
  await page.waitForURL(/\/pay\/crypto/, { timeout: 60_000 });
}

export function orderIdFromPayUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  const id = u.searchParams.get("orderId");
  if (!id) throw new Error(`No orderId in ${pageUrl}`);
  return id;
}
