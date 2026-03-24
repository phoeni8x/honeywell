/** Admin settings `fulfillment_*_enabled`: "0" / off = disabled; default on. */

export function parseFulfillmentOptionEnabled(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null || raw === "") return true;
  const s = raw.trim().toLowerCase();
  if (s === "0" || s === "false" || s === "off" || s === "no" || s === "closed") return false;
  return true;
}
