import { notifyCustomerPush } from "@/lib/push-notify";
import { createServiceClient } from "@/lib/supabase/admin";
import { notifyCustomerLockerViaTelegram } from "@/lib/telegram-locker-notify";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_LOCATION = 2000;
const MAX_PASSCODE = 64;
const MAX_PROVIDER = 48;

export type IssueLockerInput = {
  orderId: string;
  lockerProvider: string;
  lockerLocationText: string;
  lockerPasscode: string;
};

export function validateIssueLockerInput(input: IssueLockerInput): { ok: true } | { ok: false; error: string; code: string } {
  const loc = input.lockerLocationText.trim();
  const code = input.lockerPasscode.trim();
  const prov = input.lockerProvider.trim();
  if (loc.length < 3 || loc.length > MAX_LOCATION) {
    return { ok: false, error: "Location must be at least 3 characters and under the length limit.", code: "invalid_location" };
  }
  if (code.length < 2 || code.length > MAX_PASSCODE) {
    return { ok: false, error: "Passcode must be at least 2 characters and under the length limit.", code: "invalid_passcode" };
  }
  if (prov.length > MAX_PROVIDER) {
    return { ok: false, error: "Invalid provider value.", code: "invalid_provider" };
  }
  return { ok: true };
}

/**
 * Runs `issue_locker_for_dead_drop_order` and notifies customer (push + Telegram).
 * Caller must ensure order is in `awaiting_dead_drop`.
 */
export async function issueLockerForDeadDropOrderAndNotify(
  svc: SupabaseClient,
  input: IssueLockerInput
): Promise<{ ok: true } | { ok: false; error: string; code?: string; status: number }> {
  const v = validateIssueLockerInput(input);
  if (!v.ok) return { ok: false, error: v.error, code: v.code, status: 400 };

  const lockerProvider = input.lockerProvider.trim();
  const lockerLocationText = input.lockerLocationText.trim();
  const lockerPasscode = input.lockerPasscode.trim();

  const { error: rpcErr } = await svc.rpc("issue_locker_for_dead_drop_order", {
    p_order_id: input.orderId,
    p_locker_provider: lockerProvider || null,
    p_locker_location_text: lockerLocationText,
    p_locker_passcode: lockerPasscode,
  });

  if (rpcErr) {
    const msg = String(rpcErr.message ?? "").toLowerCase();
    if (msg.includes("locker_location_required")) {
      return { ok: false, error: "Location is required.", code: "invalid_location", status: 400 };
    }
    if (msg.includes("locker_passcode_required")) {
      return { ok: false, error: "Passcode is required.", code: "invalid_passcode", status: 400 };
    }
    if (msg.includes("not_awaiting_dead_drop") || msg.includes("not_dead_drop")) {
      return { ok: false, error: "Order is not ready for locker issuance.", code: "invalid_state", status: 400 };
    }
    if (msg.includes("dead_drop_already_assigned")) {
      return {
        ok: false,
        error: "This order already has a pickup location assigned in the system.",
        code: "already_assigned",
        status: 400,
      };
    }
    if (msg.includes("locker_already_issued")) {
      return { ok: false, error: "Locker details were already issued for this order.", code: "already_issued", status: 400 };
    }
    console.error("[issue_locker_for_dead_drop_order]", rpcErr);
    return { ok: false, error: "Could not issue locker.", status: 400 };
  }

  const { data: order } = await svc
    .from("orders")
    .select("customer_token, customer_username, order_number, quantity, products(name)")
    .eq("id", input.orderId)
    .maybeSingle();

  const customerToken = order?.customer_token as string | undefined;
  const orderNumber = (order?.order_number as string | undefined) ?? input.orderId.slice(0, 8);
  const productName = (order?.products as { name?: string } | null | undefined)?.name ?? "your order";
  const orderQty = Math.max(1, Math.floor(Number(order?.quantity ?? 1) || 1));

  if (customerToken) {
    void notifyCustomerPush(customerToken, {
      title: "Parcel locker ready",
      body: "Open your order for machine location and locker code.",
      url: `/account/orders/${input.orderId}/track`,
      tag: `order-${input.orderId}-locker`,
    });
  }

  void notifyCustomerLockerViaTelegram({
    svc,
    orderNumber,
    productName,
    quantity: orderQty,
    lockerProvider: lockerProvider || null,
    lockerLocationText,
    lockerPasscode,
    customerToken: customerToken ?? "",
    customerUsername: (order?.customer_username as string | null | undefined) ?? null,
  });

  return { ok: true };
}

/** Convenience wrapper using service client. */
export async function issueLockerForDeadDropOrderAndNotifyService(input: IssueLockerInput) {
  return issueLockerForDeadDropOrderAndNotify(createServiceClient(), input);
}
