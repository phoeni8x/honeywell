/**
 * Product inventory was reduced when the order was placed (not held until admin approval).
 */
export function productStockWasDeductedAtCheckout(defer_stock_until_approval: unknown): boolean {
  return !Boolean(defer_stock_until_approval);
}

/**
 * When voiding a `payment_pending` order, restore product stock if it was
 * deducted at checkout (`defer_stock_until_approval` is false).
 */
export function shouldRestoreProductStockOnPaymentPendingVoid(order: {
  status: unknown;
  defer_stock_until_approval?: unknown;
}): boolean {
  if (String(order.status) !== "payment_pending") return false;
  return productStockWasDeductedAtCheckout(order.defer_stock_until_approval);
}
