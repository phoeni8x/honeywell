/** Admin settings `fulfillment_*_enabled`: "0" / off = disabled; default on. */

export function parseFulfillmentOptionEnabled(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null || raw === "") return true;
  const s = raw.trim().toLowerCase();
  if (s === "0" || s === "false" || s === "off" || s === "no" || s === "closed") return false;
  return true;
}

/**
 * Parcel locker / dead-drop checkout toggle from `settings.fulfillment_dead_drop_enabled`.
 * Set `FORCE_FULFILLMENT_DEAD_DROP_ENABLED=true` on the server to allow checkout even when the DB flag is off (testing / emergency).
 */
export function isFulfillmentDeadDropCheckoutEnabled(raw: string | undefined | null): boolean {
  const force = process.env.FORCE_FULFILLMENT_DEAD_DROP_ENABLED?.trim().toLowerCase();
  if (force === "1" || force === "true" || force === "yes" || force === "on") return true;
  return parseFulfillmentOptionEnabled(raw);
}
