/** How pre-orders behave vs the shop's parcel-locker checkout toggle. */
export type PreorderPaymentMode = "shop_default" | "payment" | "booking";

export function isPreorderLine(
  allowPreorder: boolean | null | undefined,
  stockQuantity: number,
  quantity: number
): boolean {
  return Boolean(allowPreorder) && Number(stockQuantity) < quantity;
}

/** True = booking path (no upfront payment); false = paid checkout (revolut). */
export function effectivePreorderBookingMode(args: {
  parcelLockerCheckout: boolean;
  allowPreorder?: boolean | null;
  stockQuantity: number;
  quantity: number;
  preorderPaymentMode?: PreorderPaymentMode | null;
}): boolean {
  const { parcelLockerCheckout, allowPreorder, stockQuantity, quantity, preorderPaymentMode } = args;
  const isPo = isPreorderLine(allowPreorder, stockQuantity, quantity);
  if (!isPo) {
    return !parcelLockerCheckout;
  }
  const mode = preorderPaymentMode ?? "shop_default";
  if (mode === "payment") return false;
  if (mode === "booking") return true;
  return !parcelLockerCheckout;
}
