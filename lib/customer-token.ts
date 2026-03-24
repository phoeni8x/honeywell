"use client";

import { LS_CUSTOMER_TOKEN } from "@/lib/constants";

/** In-memory fallback when both localStorage and sessionStorage throw (common in Telegram WebViews). */
let memoryCustomerToken: string | null = null;

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

function readToken(): string | null {
  try {
    return localStorage.getItem(LS_CUSTOMER_TOKEN);
  } catch {
    try {
      return sessionStorage.getItem(LS_CUSTOMER_TOKEN);
    } catch {
      return memoryCustomerToken;
    }
  }
}

function writeToken(t: string): void {
  try {
    localStorage.setItem(LS_CUSTOMER_TOKEN, t);
    return;
  } catch {
    try {
      sessionStorage.setItem(LS_CUSTOMER_TOKEN, t);
    } catch {
      memoryCustomerToken = t;
    }
  }
}

/**
 * Stable per-browser customer id for guest APIs (orders, support, wallet).
 * Never returns "" in a browser context — uses localStorage, then sessionStorage, then memory
 * if storage is blocked (Telegram Mini App / strict WebViews).
 */
export function getOrCreateCustomerToken(): string {
  if (typeof window === "undefined") return "";
  let t = readToken();
  if (!t) {
    t = newCustomerToken();
    writeToken(t);
  }
  memoryCustomerToken = t;
  return t;
}
