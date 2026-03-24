"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { useEffect, useRef } from "react";

/** Ensures bees/points wallet rows exist before checkout, support, or wallet APIs (important for Telegram WebView). */
export function CustomerBootstrap() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = getOrCreateCustomerToken();
    if (!token) return;
    void fetch("/api/customer/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_token: token }),
    }).catch(() => {});
  }, []);

  return null;
}
