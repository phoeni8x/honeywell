import type { ShopCurrency } from "@/lib/currency";
import { formatPriceAmount, parseShopCurrency } from "@/lib/currency";
import type { Product, UserType } from "@/types";

function finitePrice(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/** Format a price for display. Pass `currency` from settings or `useShopCurrency()`. */
export function formatPrice(n: number, currency: ShopCurrency | string = "HUF"): string {
  const c = typeof currency === "string" ? parseShopCurrency(currency) : currency;
  return formatPriceAmount(finitePrice(n), c);
}

export function getPriceForUser(
  product: Product,
  userType: UserType | null
): { unit: number; isDiscounted: boolean } {
  // UI-only override for the "Somango" product pricing expected by the customer.
  // (Keeps existing DB values for everything else.)
  const productName = String(product.name ?? "").toLowerCase();
  const isSomango = productName.includes("somango");

  if (userType === "team_member") {
    return { unit: finitePrice(product.price_team_member), isDiscounted: true };
  }
  if (isSomango) {
    return { unit: 12000, isDiscounted: false };
  }
  return { unit: finitePrice(product.price_regular), isDiscounted: false };
}

export function truncateToken(token: string, head = 6, tail = 4): string {
  if (token.length <= head + tail) return token;
  return `${token.slice(0, head)}…${token.slice(-tail)}`;
}

/** Admin + tables: human-readable payment method. */
export function adminOrderPaymentLabel(method: string | null | undefined): string {
  const m = String(method ?? "").trim().toLowerCase();
  if (m === "revolut") return "Bank transfer";
  if (m === "crypto") return "Crypto";
  if (m === "bees") return "Bees";
  if (m === "points") return "Points";
  if (m === "booking") return "Booking (no payment yet)";
  return method?.trim() || "—";
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  payment_pending: "Awaiting Payment",
  awaiting_dead_drop: "Payment OK — assign drop",
  pre_ordered: "Pre-Ordered",
  payment_expired: "Payment Expired",
  waiting: "Waiting",
  confirmed: "Order Confirmed",
  ready_at_drop: "Ready at Drop Point",
  ready_for_pickup: "Ready for Pickup",
  out_for_delivery: "Out for Delivery",
  customer_arrived: "Arrived at Location",
  pickup_submitted: "Proof Submitted",
  pickup_flagged: "Proof Flagged",
  delivered: "Delivered",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};
