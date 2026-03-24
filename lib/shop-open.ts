/** Admin setting `shop_open`: when false, checkout is blocked. Default: open. */
export function parseShopOpen(raw: string | undefined | null): boolean {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!v) return true;
  if (v === "0" || v === "false" || v === "closed" || v === "off" || v === "no") return false;
  return true;
}
