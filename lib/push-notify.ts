import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/admin";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;
  if (!pub || !priv || !email) return false;
  webpush.setVapidDetails(`mailto:${email}`, pub, priv);
  vapidConfigured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_EMAIL
  );
}

async function sendToSubscription(
  raw: unknown,
  payload: PushPayload
): Promise<"ok" | "gone" | "fail"> {
  if (!ensureVapid()) return "fail";
  if (!raw || typeof raw !== "object") return "fail";
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag ?? "honeywell",
  });
  try {
    await webpush.sendNotification(raw as webpush.PushSubscription, body, {
      TTL: 3600,
      urgency: "normal",
    });
    return "ok";
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push send]", e);
    return "fail";
  }
}

/** Notify a customer by stored Web Push subscription (guest token). */
export async function notifyCustomerPush(customerToken: string, payload: PushPayload): Promise<void> {
  try {
    if (!isPushConfigured()) return;
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("push_subscriptions")
      .select("subscription")
      .eq("customer_token", customerToken)
      .maybeSingle();
    if (error || !data?.subscription) return;
    const result = await sendToSubscription(data.subscription, payload);
    if (result === "gone") {
      await svc.from("push_subscriptions").delete().eq("customer_token", customerToken);
    }
  } catch (e) {
    console.error("[notifyCustomerPush]", e);
  }
}

/** Notify the admin device (single row). */
export async function notifyAdminPush(payload: PushPayload): Promise<void> {
  try {
    if (!isPushConfigured()) return;
    const svc = createServiceClient();
    const { data, error } = await svc.from("admin_push_subscription").select("subscription").eq("id", 1).maybeSingle();
    if (error || !data?.subscription) return;
    const result = await sendToSubscription(data.subscription, payload);
    if (result === "gone") {
      await svc.from("admin_push_subscription").update({ subscription: null, updated_at: new Date().toISOString() }).eq("id", 1);
    }
  } catch (e) {
    console.error("[notifyAdminPush]", e);
  }
}
