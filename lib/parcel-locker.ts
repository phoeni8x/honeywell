export const LOCKER_PROVIDER_OPTIONS = [
  { value: "gls", label: "GLS parcel locker" },
  { value: "packeta", label: "Packeta / Z-Box" },
  { value: "foxpost", label: "Foxpost" },
  { value: "other", label: "Other" },
] as const;

export function lockerProviderDisplayLabel(provider: string | null | undefined): string {
  if (!provider?.trim()) return "Parcel locker";
  const v = provider.trim().toLowerCase();
  const m = LOCKER_PROVIDER_OPTIONS.find((o) => o.value === v);
  return m?.label ?? provider.trim();
}

/** First https URL in freeform location text, if any. */
export function extractFirstHttpUrl(text: string): string | null {
  const m = text.trim().match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0]! : null;
}

export function mapsSearchUrlGoogle(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}

export function mapsSearchUrlApple(query: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(query.trim())}`;
}

/** Confirmed dead-drop order with either legacy pool slot or new parcel locker details. */
export function isDeadDropFulfillmentLocationIssued(order: {
  fulfillment_type?: string | null;
  status?: string;
  dead_drop_id?: string | null;
  locker_location_text?: string | null;
  locker_passcode?: string | null;
}): boolean {
  if (order.fulfillment_type !== "dead_drop" || order.status !== "confirmed") return false;
  if (order.dead_drop_id) return true;
  const loc = typeof order.locker_location_text === "string" ? order.locker_location_text.trim() : "";
  const code = typeof order.locker_passcode === "string" ? order.locker_passcode.trim() : "";
  return loc.length >= 3 && code.length >= 2;
}
