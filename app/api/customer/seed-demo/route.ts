import { getCustomerTokenFromRequest } from "@/lib/customer-request";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { seedCustomerDemoData } from "@/lib/seed-customer-demo";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const envKey = process.env.CUSTOMER_DEMO_SEED_KEY?.trim();
  let allowed = false;
  if (!envKey) {
    allowed = process.env.NODE_ENV === "development";
  } else {
    const headerKey = request.headers.get("x-demo-seed-key")?.trim();
    if (headerKey === envKey) allowed = true;
    if (!allowed) {
      try {
        const body = (await request.json()) as { demo_seed_key?: string };
        if (typeof body?.demo_seed_key === "string" && body.demo_seed_key.trim() === envKey) {
          allowed = true;
        }
      } catch {
        /* ignore invalid JSON */
      }
    }
  }

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          envKey
            ? "Demo seed is protected. Provide the configured key."
            : "Demo seed is disabled. Set CUSTOMER_DEMO_SEED_KEY or run in development.",
        code: "demo_seed_disabled",
      },
      { status: 403 }
    );
  }

  const result = await seedCustomerDemoData(token);
  if (!result.ok) {
    const map: Record<string, string> = {
      no_active_product: "No active product in the shop — add a product first.",
      order_insert_failed: "Could not create demo orders.",
      ticket_insert_failed: "Could not create demo tickets.",
    };
    return NextResponse.json(
      { error: map[result.error] ?? PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, code: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
