export function parseSupportEnabled(value: unknown): boolean {
  if (typeof value !== "string") return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return !(normalized === "0" || normalized === "false" || normalized === "off" || normalized === "disabled");
}
