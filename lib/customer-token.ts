"use client";

import { LS_CUSTOMER_TOKEN } from "@/lib/constants";

function newCustomerToken(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* WebView may block crypto */
  }
  return `hw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateCustomerToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let t = localStorage.getItem(LS_CUSTOMER_TOKEN);
    if (!t) {
      t = newCustomerToken();
      localStorage.setItem(LS_CUSTOMER_TOKEN, t);
    }
    return t;
  } catch {
    /* Telegram / private mode: avoid crashing the Mini App */
    return "";
  }
}
