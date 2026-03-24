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

/** Share token between apex and www (separate localStorage origins). */
function cookieDomainForHost(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return undefined;
  if (h.endsWith(".vercel.app")) return undefined;
  if (h.endsWith("teamruby.net")) return ".teamruby.net";
  return undefined;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp(`(?:^|; )${esc}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function setSharedCookie(t: string): void {
  const domain = cookieDomainForHost();
  if (!domain || typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 400;
  const secure = window.location.protocol === "https:";
  document.cookie = `${LS_CUSTOMER_TOKEN}=${encodeURIComponent(t)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}; Domain=${domain}`;
}

function readToken(): string | null {
  try {
    const ls = localStorage.getItem(LS_CUSTOMER_TOKEN);
    if (ls) return ls;
  } catch {
    /* fall through */
  }
  try {
    const ss = sessionStorage.getItem(LS_CUSTOMER_TOKEN);
    if (ss) return ss;
  } catch {
    /* fall through */
  }
  if (memoryCustomerToken) return memoryCustomerToken;
  return readCookie(LS_CUSTOMER_TOKEN);
}

function writeToken(t: string): void {
  try {
    localStorage.setItem(LS_CUSTOMER_TOKEN, t);
  } catch {
    try {
      sessionStorage.setItem(LS_CUSTOMER_TOKEN, t);
    } catch {
      memoryCustomerToken = t;
    }
  }
  setSharedCookie(t);
}

/** Force a specific token into storage/cookie for this browser session. */
export function setCustomerToken(token: string): string {
  const t = String(token ?? "").trim();
  if (!t) return "";
  memoryCustomerToken = t;
  writeToken(t);
  return t;
}

/**
 * Stable per-browser customer id for guest APIs (orders, support, wallet).
 * Never returns "" in a browser context — uses localStorage, then sessionStorage, then memory
 * if storage is blocked (Telegram Mini App / strict WebViews).
 */
export function getOrCreateCustomerToken(): string {
  if (typeof window === "undefined") return "";
  const cookieToken = readCookie(LS_CUSTOMER_TOKEN)?.trim() ?? "";
  let t = readToken();
  // Cookie is shared across apex+www and should win over stale origin-local storage.
  if (cookieToken && cookieToken !== t) {
    t = cookieToken;
  }
  if (!t) {
    t = newCustomerToken();
    writeToken(t);
  } else {
    try {
      if (!localStorage.getItem(LS_CUSTOMER_TOKEN)) {
        writeToken(t);
      }
    } catch {
      try {
        if (!sessionStorage.getItem(LS_CUSTOMER_TOKEN)) {
          sessionStorage.setItem(LS_CUSTOMER_TOKEN, t);
        }
      } catch {
        memoryCustomerToken = t;
      }
    }
    setSharedCookie(t);
  }
  memoryCustomerToken = t;
  return t;
}
