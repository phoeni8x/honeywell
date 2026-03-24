/** Normalize `x-customer-token` from API requests (trim whitespace). */
export function getCustomerTokenFromRequest(request: Request): string {
  const raw = request.headers.get("x-customer-token");
  return typeof raw === "string" ? raw.trim() : "";
}
