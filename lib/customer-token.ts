"use client";

import { LS_CUSTOMER_TOKEN } from "@/lib/constants";

export function getOrCreateCustomerToken(): string {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem(LS_CUSTOMER_TOKEN);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(LS_CUSTOMER_TOKEN, t);
  }
  return t;
}
