/**
 * Part 8 compatibility aliases — canonical implementation lives in `@/lib/customer-token`.
 */
export {
  getOrCreateCustomerToken as getCustomerToken,
  getOrCreateCustomerToken as ensureCustomerToken,
  setCustomerToken,
} from "@/lib/customer-token";
