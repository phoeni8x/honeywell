const STORAGE_KEY = "honeywell_customer_token";

/**
 * Returns a stable customer token.
 * Priority:
 * 1. Telegram user ID (permanent across all sessions) - "tg_<userId>"
 * 2. Existing localStorage token (already created before)
 * 3. New random UUID (fallback for non-Telegram browsers)
 */
export function getOrCreateCustomerToken(): string {
  if (typeof window === "undefined") return "";

  try {
    const tg = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number | string } } } } }).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      const telegramToken = `tg_${tg.initDataUnsafe.user.id}`;
      try {
        localStorage.setItem(STORAGE_KEY, telegramToken);
      } catch {}
      return telegramToken;
    }
  } catch {}

  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
  } catch {}

  const newToken =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem(STORAGE_KEY, newToken);
  } catch {}
  return newToken;
}

export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const tg = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number | string } } } } }).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      return `tg_${tg.initDataUnsafe.user.id}`;
    }
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCustomerToken(token: string): string {
  const next = String(token ?? "").trim();
  if (!next) return "";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  return next;
}
