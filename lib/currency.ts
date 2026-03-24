/** Display currency for product/order amounts (stored as raw numbers in DB). */
export type ShopCurrency = "HUF" | "EUR";

export function parseShopCurrency(raw: string | undefined | null): ShopCurrency {
  const u = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (u === "EUR") return "EUR";
  return "HUF";
}

export function formatPriceAmount(n: number, currency: ShopCurrency): string {
  const v = Number.isFinite(n) ? n : 0;
  if (currency === "EUR") {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  }
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(v);
}
