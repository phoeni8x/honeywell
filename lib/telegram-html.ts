/** Escape text for Telegram Bot API parse_mode HTML. */
export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Allow http(s) URLs inside <a href>. */
export function safeHrefForTelegramHtml(url: string): string | null {
  const t = url.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  return t.replace(/"/g, "&quot;");
}

export function buildDeadDropCustomerMessageHtml(opts: {
  orderNumber: string;
  productName: string;
  quantity: number;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  city: string | null | undefined;
  areaLabel: string | null | undefined;
  instructions: string | null | undefined;
}): string {
  const esc = escapeTelegramHtml;
  const lines: string[] = [];
  lines.push(`🍯 <b>Honey Well</b> — Free drop`);
  lines.push("");
  lines.push(`🆔 <b>ID:</b> ${esc(opts.orderNumber)}`);
  const q = Math.max(1, Math.floor(Number(opts.quantity) || 1));
  const qtySuffix = q > 1 ? ` • ×${q}` : "";
  lines.push(`<b>${esc(opts.productName)}</b>${qtySuffix}`);
  lines.push("");
  lines.push(`📍 <b>Location details:</b>`);
  if (opts.latitude != null && opts.longitude != null) {
    lines.push(`• Coordinates: ${esc(String(opts.latitude))}, ${esc(String(opts.longitude))}`);
  }
  const city = opts.city?.trim();
  if (city) lines.push(`• City: ${esc(city)}`);
  const area = opts.areaLabel?.trim();
  if (area) lines.push(`• Area: ${esc(area)}`);
  const safeHref = opts.mapsUrl ? safeHrefForTelegramHtml(opts.mapsUrl) : null;
  if (safeHref) {
    lines.push(`• Map: <a href="${safeHref}">Click here to view</a>`);
  } else {
    lines.push(`• Map: —`);
  }
  lines.push("");
  lines.push(`💬 <b>Note from courier:</b>`);
  const note = opts.instructions?.trim();
  lines.push(note ? esc(note) : "—");
  return lines.join("\n");
}

export function buildLockerCustomerMessageHtml(opts: {
  orderNumber: string;
  productName: string;
  quantity: number;
  providerLabel: string;
  locationText: string;
  passcode: string;
}): string {
  const esc = escapeTelegramHtml;
  const q = Math.max(1, Math.floor(Number(opts.quantity) || 1));
  const qtySuffix = q > 1 ? ` • ×${q}` : "";
  const lines: string[] = [];
  lines.push(`🍯 <b>Honey Well</b> — Parcel locker`);
  lines.push("");
  lines.push(`🆔 <b>ID:</b> ${esc(opts.orderNumber)}`);
  lines.push(`<b>${esc(opts.productName)}</b>${qtySuffix}`);
  lines.push("");
  lines.push(`📦 <b>Carrier:</b> ${esc(opts.providerLabel)}`);
  lines.push("");
  lines.push(`📍 <b>Locker / machine:</b>`);
  lines.push(esc(opts.locationText));
  lines.push("");
  lines.push(`🔐 <b>Locker code:</b> <code>${esc(opts.passcode)}</code>`);
  return lines.join("\n");
}
