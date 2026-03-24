"use client";

import { setCustomerToken } from "@/lib/customer-token";

/**
 * Aligns guest `customer_token` with the order when `orderId` is in the URL.
 * `queryToken` (`ct` param) is only used when there is no order or adopt fails — never prefer it over adopt when `orderId` is set (middleware may have appended a stale `ct`).
 */
export async function syncCustomerTokenFromUrl(orderId: string | null, queryToken: string): Promise<void> {
  if (orderId) {
    const r = await fetch("/api/orders/adopt-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
    const body = (await r.json().catch(() => ({}))) as { customer_token?: string };
    if (r.ok && body.customer_token) {
      setCustomerToken(body.customer_token);
      return;
    }
    if (queryToken) setCustomerToken(queryToken);
    return;
  }
  if (queryToken) setCustomerToken(queryToken);
}
