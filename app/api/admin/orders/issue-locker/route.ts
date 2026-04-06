import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { notifyCustomerPush } from "@/lib/push-notify";
import { createServiceClient } from "@/lib/supabase/admin";
import { notifyCustomerLockerViaTelegram } from "@/lib/telegram-locker-notify";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_LOCATION = 2000;
const MAX_PASSCODE = 64;
const MAX_PROVIDER = 48;

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const body = await request.json();
    const orderId = body.order_id as string | undefined;
    const lockerProvider = typeof body.locker_provider === "string" ? body.locker_provider.trim() : "";
    const lockerLocationText = typeof body.locker_location_text === "string" ? body.locker_location_text.trim() : "";
    const lockerPasscode = typeof body.locker_passcode === "string" ? body.locker_passcode.trim() : "";

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }
    if (lockerLocationText.length < 3 || lockerLocationText.length > MAX_LOCATION) {
      return NextResponse.json(
        { error: "Location must be at least 3 characters and under the length limit.", code: "invalid_location" },
        { status: 400 }
      );
    }
    if (lockerPasscode.length < 2 || lockerPasscode.length > MAX_PASSCODE) {
      return NextResponse.json(
        { error: "Passcode must be at least 2 characters and under the length limit.", code: "invalid_passcode" },
        { status: 400 }
      );
    }
    if (lockerProvider.length > MAX_PROVIDER) {
      return NextResponse.json({ error: "Invalid provider value." }, { status: 400 });
    }

    const svc = createServiceClient();
    const { error: rpcErr } = await svc.rpc("issue_locker_for_dead_drop_order", {
      p_order_id: orderId,
      p_locker_provider: lockerProvider || null,
      p_locker_location_text: lockerLocationText,
      p_locker_passcode: lockerPasscode,
    });

    if (rpcErr) {
      const msg = String(rpcErr.message ?? "").toLowerCase();
      if (msg.includes("locker_location_required")) {
        return NextResponse.json({ error: "Location is required.", code: "invalid_location" }, { status: 400 });
      }
      if (msg.includes("locker_passcode_required")) {
        return NextResponse.json({ error: "Passcode is required.", code: "invalid_passcode" }, { status: 400 });
      }
      if (msg.includes("not_awaiting_dead_drop") || msg.includes("not_dead_drop")) {
        return NextResponse.json({ error: "Order is not ready for locker issuance.", code: "invalid_state" }, { status: 400 });
      }
      if (msg.includes("dead_drop_already_assigned")) {
        return NextResponse.json(
          { error: "This order already has a pickup location assigned in the system.", code: "already_assigned" },
          { status: 400 }
        );
      }
      if (msg.includes("locker_already_issued")) {
        return NextResponse.json({ error: "Locker details were already issued for this order.", code: "already_issued" }, { status: 400 });
      }
      console.error("[issue_locker_for_dead_drop_order]", rpcErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const { data: order } = await svc
      .from("orders")
      .select("customer_token, customer_username, order_number, quantity, products(name)")
      .eq("id", orderId)
      .maybeSingle();

    const customerToken = order?.customer_token as string | undefined;
    const orderNumber = (order?.order_number as string | undefined) ?? orderId.slice(0, 8);
    const productName =
      (order?.products as { name?: string } | null | undefined)?.name ?? "your order";
    const orderQty = Math.max(1, Math.floor(Number(order?.quantity ?? 1) || 1));

    if (customerToken) {
      void notifyCustomerPush(customerToken, {
        title: "Parcel locker ready",
        body: "Open your order for machine location and locker code.",
        url: `/account/orders/${orderId}/track`,
        tag: `order-${orderId}-locker`,
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

    return NextResponse.json({ ok: true, order_id: orderId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}
