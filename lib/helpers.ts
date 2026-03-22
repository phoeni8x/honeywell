import type { Product, UserType } from "@/types";

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

export function getPriceForUser(
  product: Product,
  userType: UserType | null
): { unit: number; isDiscounted: boolean } {
  if (userType === "team_member") {
    return { unit: Number(product.price_team_member), isDiscounted: true };
  }
  return { unit: Number(product.price_regular), isDiscounted: false };
}

export function truncateToken(token: string, head = 6, tail = 4): string {
  if (token.length <= head + tail) return token;
  return `${token.slice(0, head)}…${token.slice(-tail)}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  payment_pending: "Awaiting Payment",
  payment_expired: "Payment Expired",
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
